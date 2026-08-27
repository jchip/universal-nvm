import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const common = require('../../lib/common');
const switchVersion = require('../../lib/switch');

// UNV-11: switch.js resolved "lts" with a hardcoded getRemoteFromJson(null, true,
// true), so `nvm link lts` ignored --proxy/--no-ssl and NVM_PROXY and failed
// behind a proxy while install and ls-remote worked.
describe('switch (nvm link) network options', () => {
  let tmpDir;
  let getRemote;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nvm-switch-test-'));
    process.env.NVM_LINK = path.join(tmpDir, 'nodejs', 'bin');

    vi.spyOn(common, 'findLocalVersions').mockResolvedValue(['v18.19.0', 'v20.10.0']);
    getRemote = vi.spyOn(common, 'getRemoteFromJson').mockResolvedValue(['v18.19.0', 'v20.10.0']);
    vi.spyOn(common, 'findNodeVersion').mockResolvedValue({
      version: 'v20.10.0',
      nodeDir: path.join(tmpDir, 'v20.10.0')
    });
    vi.spyOn(common, 'getNodeBinDir').mockReturnValue(path.join(tmpDir, 'v20.10.0', 'bin'));
    vi.spyOn(common, 'createEnvironmentTmp').mockResolvedValue(undefined);
    vi.spyOn(common, 'setNvmLinkPath').mockResolvedValue(undefined);
    vi.spyOn(common, 'log').mockImplementation(() => {});
    // a failed link must not take the test process down with it
    vi.spyOn(common, 'exit').mockImplementation(() => {
      throw new Error('common.exit called');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.NVM_LINK;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('forwards proxy and verifyssl when resolving "lts"', async () => {
    await switchVersion('lts', { proxy: 'http://proxy.corp:8080', verifyssl: false });

    expect(getRemote).toHaveBeenCalledWith('http://proxy.corp:8080', false, true);
  });

  it('defaults to verifyssl true and no proxy when none are given', async () => {
    await switchVersion('lts');

    expect(getRemote).toHaveBeenCalledWith(undefined, true, true);
  });

  it('keeps ssl verification on when only a proxy is set', async () => {
    await switchVersion('lts', { proxy: 'http://proxy.corp:8080' });

    expect(getRemote).toHaveBeenCalledWith('http://proxy.corp:8080', true, true);
  });

  it('reports the proxy it is about to use', async () => {
    const logProxy = vi.spyOn(common, 'logProxyInfo').mockImplementation(() => {});

    await switchVersion('lts', { proxy: 'http://proxy.corp:8080', proxySource: '--proxy flag' });

    expect(logProxy).toHaveBeenCalledWith('http://proxy.corp:8080', '--proxy flag');
  });

  // "latest" and an explicit version resolve from installed versions alone, so
  // they must not reach the network at all -- nor announce a proxy they will
  // never use.
  it('does not fetch remote versions for "latest"', async () => {
    const logProxy = vi.spyOn(common, 'logProxyInfo').mockImplementation(() => {});

    await switchVersion('latest', { proxy: 'http://proxy.corp:8080' });

    expect(getRemote).not.toHaveBeenCalled();
    expect(logProxy).not.toHaveBeenCalled();
  });

  it('does not fetch remote versions for an explicit version', async () => {
    await switchVersion('20.10.0', { proxy: 'http://proxy.corp:8080' });

    expect(getRemote).not.toHaveBeenCalled();
  });

  // UNV-12: the fetch failure used to be reported as a bare "Unable to fetch
  // remote versions", so a proxy 407, an ETIMEDOUT and a self-signed cert were
  // indistinguishable -- which is what made UNV-11 hard to diagnose in the first
  // place.
  describe('when the remote fetch fails', () => {
    const logged = () =>
      common.log.mock.calls.map(c => c.join(' ')).join('\n');

    it('reports the underlying cause', async () => {
      getRemote.mockRejectedValue(new Error('connect ETIMEDOUT 104.20.22.46:443'));

      await expect(switchVersion('lts')).rejects.toThrow('common.exit called');

      expect(logged()).toContain('connect ETIMEDOUT 104.20.22.46:443');
    });

    it('suggests proxy settings for a connection-level failure when no proxy is set', async () => {
      getRemote.mockRejectedValue(
        Object.assign(new Error('connect ECONNREFUSED 10.0.0.1:8080'), { code: 'ECONNREFUSED' })
      );

      await expect(switchVersion('lts')).rejects.toThrow('common.exit called');

      expect(logged()).toMatch(/NVM_PROXY/);
    });

    it('does not suggest a proxy when one is already in use', async () => {
      getRemote.mockRejectedValue(new Error('tunneling socket could not be established, 407'));

      await expect(
        switchVersion('lts', { proxy: 'http://proxy.corp:8080' })
      ).rejects.toThrow('common.exit called');

      const out = logged();
      expect(out).toContain('407');
      expect(out).not.toMatch(/NVM_PROXY/);
    });

    it('does not blame the network for a non-network failure', async () => {
      getRemote.mockRejectedValue(new Error('Unexpected token < in JSON at position 0'));

      await expect(switchVersion('lts')).rejects.toThrow('common.exit called');

      const out = logged();
      expect(out).toContain('Unexpected token');
      expect(out).not.toMatch(/NVM_PROXY/);
    });

    // chalker parses <> as color markup, so an unescaped message loses content:
    // "<html>" would be swallowed as a tag and ">=proxy" would render as
    // "=proxy". ckEscape encodes it so chalker decodes it back intact -- the same
    // class of bug UNV-4 fixed elsewhere.
    it('preserves markup characters in the error message instead of eating them', async () => {
      getRemote.mockRejectedValue(new Error('bad response <html> from >=proxy'));

      await expect(switchVersion('lts')).rejects.toThrow('common.exit called');

      const out = logged();
      expect(out).toContain('<html>');
      expect(out).toContain('>=proxy');
    });
  });

  // The no-LTS-installed path shares the lts branch but is not a fetch failure;
  // it must not be reported as one. This is why the try wraps only the fetch.
  it('reports "no LTS installed" as itself, not as a fetch failure', async () => {
    // remote list has no overlap with what is installed locally
    getRemote.mockResolvedValue(['v20.11.0']);

    await expect(switchVersion('lts')).rejects.toThrow('common.exit called');

    const out = common.log.mock.calls.map(c => c.join(' ')).join('\n');
    expect(out).toContain('No LTS versions installed');
    expect(out).not.toContain('Unable to fetch remote versions');
  });
});
