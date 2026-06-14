import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fsp } from 'fs';
import path from 'path';
import os from 'os';

// Regression: nodejsDistUrl() (which now uses WHATWG `new URL()`) was called
// OUTSIDE the try in the mirror-fallback loop of getRemoteFromJson(). Unlike the
// old lenient Url.parse, `new URL()` throws on a malformed input, so a single bad
// NVM_NODEJS_ORG_MIRROR entry crashed the whole `ls-remote`/install fetch instead
// of being skipped so the loop could fall through to a working mirror.
//
// These specs load lib/common via native require(), which bypasses vitest's
// vi.mock() layer, so we stub `needle` by injecting it into the require cache
// before common.js binds it at module load time.
const commonPath = require.resolve('../../lib/common');
const needlePath = require.resolve('needle', { paths: [path.dirname(commonPath)] });

describe('getRemoteFromJson mirror robustness (regression)', () => {
  let common;
  let originalEnv;
  let tmpDir;
  let realNeedleEntry;
  let mockNeedle;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'nvm-mirror-test-'));
    process.env.NVM_HOME = tmpDir;            // isolate the on-disk cache
    delete process.env.NVM_NODEJS_ORG_MIRROR;

    mockNeedle = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: [
        { version: 'v22.11.0', lts: false },
        { version: 'v20.18.0', lts: 'Iron' }
      ]
    });

    // Bind common.js's `const needle = require("needle")` to the mock.
    realNeedleEntry = require.cache[needlePath];
    require.cache[needlePath] = {
      id: needlePath,
      filename: needlePath,
      loaded: true,
      exports: mockNeedle
    };
    delete require.cache[commonPath];
    common = require('../../lib/common');
    common.setDistUrl(undefined);             // force the mirror list, not a pinned url
  });

  afterEach(async () => {
    // Restore real needle + a clean common for any other test file.
    if (realNeedleEntry) {
      require.cache[needlePath] = realNeedleEntry;
    } else {
      delete require.cache[needlePath];
    }
    delete require.cache[commonPath];

    process.env = originalEnv;
    await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it('skips a malformed NVM_NODEJS_ORG_MIRROR entry and falls through to a working mirror', async () => {
    process.env.NVM_NODEJS_ORG_MIRROR = 'not a valid url';   // new URL() throws on this

    // useCache=false forces the network/mirror loop where the bug lived
    const versions = await common.getRemoteFromJson(null, true, false, false);

    expect(versions).toContain('v22.11.0');
    // the bad mirror was skipped and the default https mirror was the one fetched
    expect(mockNeedle).toHaveBeenCalledTimes(1);
    expect(mockNeedle.mock.calls[0][1]).toContain('nodejs.org/dist');
  });

  it('rejects with the mirror failure (no synchronous URL crash) when every mirror fails', async () => {
    process.env.NVM_NODEJS_ORG_MIRROR = 'http://[bad';       // malformed → new URL() throws
    mockNeedle.mockReset();
    mockNeedle.mockRejectedValue(new Error('network down'));

    // Must reject with the real fetch failure, not an uncaught ERR_INVALID_URL
    await expect(
      common.getRemoteFromJson(null, true, false, false)
    ).rejects.toThrow('network down');
  });
});
