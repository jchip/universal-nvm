import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

const common = require('../../lib/common');

// symlink creation needs privilege on Windows; the non-symlink cases still run there
const onPosix = process.platform === 'win32' ? it.skip : it;

// Regression: findLinkVersion used `.match(...)[0]` with no guard, so `nvm ls`
// and `nvm uninstall` crashed when NVM_LINK pointed at a real dir (readlink
// EINVAL) or a target with no version segment (null.match). It must not throw.
describe('common.findLinkVersion (crash-safety)', () => {
  let tmpDir;
  let originalEnv;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nvm-link-test-'));
  });

  afterEach(async () => {
    process.env = originalEnv;
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  onPosix('reads the version from a symlink target', async () => {
    const target = path.join(tmpDir, 'nodejs', 'v20.10.0', 'bin');
    await fs.mkdir(target, { recursive: true });
    const link = path.join(tmpDir, 'link');
    await fs.symlink(target, link);
    process.env.NVM_LINK = link;

    expect(await common.findLinkVersion()).toBe('v20.10.0');
  });

  it('returns undefined (no throw) when the link path is a real directory', async () => {
    const real = path.join(tmpDir, 'realdir');
    await fs.mkdir(real, { recursive: true });
    process.env.NVM_LINK = real;

    expect(await common.findLinkVersion()).toBeUndefined();
  });

  onPosix('returns undefined when the symlink target has no version segment', async () => {
    const target = path.join(tmpDir, 'plain-dir');
    await fs.mkdir(target, { recursive: true });
    const link = path.join(tmpDir, 'link2');
    await fs.symlink(target, link);
    process.env.NVM_LINK = link;

    expect(await common.findLinkVersion()).toBeUndefined();
  });

  it('returns undefined when nothing is linked', async () => {
    process.env.NVM_LINK = path.join(tmpDir, 'nope');
    expect(await common.findLinkVersion()).toBeUndefined();
  });
});

// Regression: the sourced temp env file was created with the default umask
// (world-readable) in a shared, predictable tmp path. It must be owner-only.
describe('common.createEnvironmentTmp file permissions (posix)', () => {
  let tmpDir;
  let originalEnv;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nvm-envfile-test-'));
  });

  afterEach(async () => {
    process.env = originalEnv;
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  onPosix('writes the temp env file readable/writable only by the owner (0o600)', async () => {
    const file = path.join(tmpDir, 'env.sh');
    await common.createEnvironmentTmp(file, 'export X=1\n');

    const mode = (await fs.stat(file)).mode & 0o777;
    expect(mode).toBe(0o600);
  });
});

// Regression (review finding #1): createEnvironmentTmp wrote the env script in
// place at a shared, predictable tmp path. A reader could source a half-written
// file, and writeFile would follow a pre-planted symlink at the target. It must
// stage a private temp file and atomically rename(2) it into place.
describe('common.createEnvironmentTmp atomic write (posix)', () => {
  let tmpDir;
  let originalEnv;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nvm-envatomic-test-'));
  });

  afterEach(async () => {
    process.env = originalEnv;
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  onPosix('replaces a pre-planted symlink at the target instead of writing through it', async () => {
    const victim = path.join(tmpDir, 'victim');
    await fs.writeFile(victim, 'untouched\n');
    const file = path.join(tmpDir, 'env.sh');
    await fs.symlink(victim, file);

    await common.createEnvironmentTmp(file, 'export X=1\n');

    // the file the symlink pointed at must be left intact...
    expect(await fs.readFile(victim, 'utf8')).toBe('untouched\n');
    // ...and the target is now a real, owner-only file holding our content.
    const st = await fs.lstat(file);
    expect(st.isSymbolicLink()).toBe(false);
    expect(st.mode & 0o777).toBe(0o600);
    expect(await fs.readFile(file, 'utf8')).toBe('export X=1\n');
  });

  onPosix('leaves no temp file behind on success', async () => {
    const file = path.join(tmpDir, 'env.sh');
    await common.createEnvironmentTmp(file, 'export X=1\n');

    const leftovers = (await fs.readdir(tmpDir)).filter((n) => n.endsWith('.tmp'));
    expect(leftovers).toEqual([]);
  });
});

// Regression: switch-deactivate (`nvm unlink`) guarded the unlink with
// common._exists (fs.access), which follows symlinks and so reports a *dangling*
// default-version symlink as missing -- leaving the broken link behind. It must
// detect the link itself (lstat) and remove it.
describe('switch-deactivate removes a dangling default-version symlink', () => {
  const switchDeactivate = require('../../lib/switch-deactivate');
  let tmpDir;
  let originalEnv;
  let originalExit;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    originalExit = common.exit;
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nvm-unlink-test-'));
    // contain createEnvironmentTmp's side-effect file inside tmpDir
    process.env.NVM_TMPDIR = tmpDir;
    delete process.env.NVM_USE; // take the resetNvmPaths + createEnvironmentTmp branch
    // a failure would call common.exit -> process.exit and kill the runner
    common.exit = () => {
      throw new Error('switch-deactivate called common.exit');
    };
  });

  afterEach(async () => {
    process.env = originalEnv;
    common.exit = originalExit;
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  onPosix('unlinks a dangling symlink that _exists/access would skip', async () => {
    const link = path.join(tmpDir, 'nodejs-bin');
    await fs.symlink(path.join(tmpDir, 'gone'), link); // target does not exist
    process.env.NVM_LINK = link;

    // document the bug being fixed: access() follows the link and says "missing"
    expect(await common._exists(link)).toBe(false);
    expect((await fs.lstat(link)).isSymbolicLink()).toBe(true);

    await switchDeactivate();

    await expect(fs.lstat(link)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  onPosix('still unlinks a valid symlink', async () => {
    const target = path.join(tmpDir, 'real-bin');
    await fs.mkdir(target, { recursive: true });
    const link = path.join(tmpDir, 'nodejs-bin');
    await fs.symlink(target, link);
    process.env.NVM_LINK = link;

    await switchDeactivate();

    await expect(fs.lstat(link)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
