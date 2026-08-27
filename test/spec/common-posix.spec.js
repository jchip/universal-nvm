import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the dependencies before requiring the module
const mockLog = vi.fn();

// We need to test the posix module directly, but common.js includes platform detection
// So we'll require it directly
const path = require('path');
const os = require('os');

describe('common-posix utility functions', () => {
  let originalPlatform;
  let originalEnv;
  let commonPosix;

  beforeEach(() => {
    originalPlatform = process.platform;
    originalEnv = { ...process.env };

    // Clear module cache to get fresh instance
    delete require.cache[require.resolve('../../lib/common-posix')];
    commonPosix = require('../../lib/common-posix');

    // Add mock functions that common-posix needs from common
    commonPosix._exists = vi.fn();
    commonPosix.log = mockLog;
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true,
      configurable: true
    });
    process.env = originalEnv;
    mockLog.mockClear();
  });

  describe('getNodeBinDir', () => {
    it('should return nodeDir on Windows platform', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
        configurable: true
      });

      const result = commonPosix.getNodeBinDir('/path/to/node/v18.20.0');
      expect(result).toBe('/path/to/node/v18.20.0');
    });

    it('should return nodeDir/bin on non-Windows platforms', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true,
        configurable: true
      });

      const result = commonPosix.getNodeBinDir('/path/to/node/v18.20.0');
      expect(result).toBe(path.join('/path/to/node/v18.20.0', 'bin'));
    });

    it('should return nodeDir/bin on macOS', () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: true,
        configurable: true
      });

      const result = commonPosix.getNodeBinDir('/usr/local/nvm/v20.10.0');
      expect(result).toBe(path.join('/usr/local/nvm/v20.10.0', 'bin'));
    });
  });

  describe('makeNodeDistName', () => {
    it('should create dist name for Linux x64', () => {
      const osSpy = vi.spyOn(os, 'platform').mockReturnValue('linux');
      const archSpy = vi.spyOn(os, 'arch').mockReturnValue('x64');

      const result = commonPosix.makeNodeDistName('v18.20.0');
      expect(result).toBe('node-v18.20.0-linux-x64');

      osSpy.mockRestore();
      archSpy.mockRestore();
    });

    it('should create dist name for macOS arm64', () => {
      const osSpy = vi.spyOn(os, 'platform').mockReturnValue('darwin');
      const archSpy = vi.spyOn(os, 'arch').mockReturnValue('arm64');

      const result = commonPosix.makeNodeDistName('v18.20.0');
      expect(result).toBe('node-v18.20.0-darwin-arm64');

      osSpy.mockRestore();
      archSpy.mockRestore();
    });

    it('should fallback to x64 for macOS arm64 on Node < 16', () => {
      const osSpy = vi.spyOn(os, 'platform').mockReturnValue('darwin');
      const archSpy = vi.spyOn(os, 'arch').mockReturnValue('arm64');

      const result = commonPosix.makeNodeDistName('v14.21.3');
      expect(result).toBe('node-v14.21.3-darwin-x64');
      expect(mockLog).toHaveBeenCalledWith(
        expect.stringContaining('falling back to x64')
      );

      osSpy.mockRestore();
      archSpy.mockRestore();
    });

    it('should use arm64 for macOS on Node >= 16', () => {
      const osSpy = vi.spyOn(os, 'platform').mockReturnValue('darwin');
      const archSpy = vi.spyOn(os, 'arch').mockReturnValue('arm64');

      const result = commonPosix.makeNodeDistName('v16.0.0');
      expect(result).toBe('node-v16.0.0-darwin-arm64');
      expect(mockLog).not.toHaveBeenCalled();

      osSpy.mockRestore();
      archSpy.mockRestore();
    });

    it('should handle lowercase platform and arch', () => {
      const osSpy = vi.spyOn(os, 'platform').mockReturnValue('LINUX');
      const archSpy = vi.spyOn(os, 'arch').mockReturnValue('ARM64');

      const result = commonPosix.makeNodeDistName('v20.10.0');
      expect(result).toBe('node-v20.10.0-linux-arm64');

      osSpy.mockRestore();
      archSpy.mockRestore();
    });
  });

  describe('cacheFileName', () => {
    it('should return node.tgz', () => {
      expect(commonPosix.cacheFileName()).toBe('node.tgz');
    });
  });

  describe('makeNodeDistFileName', () => {
    it('should create dist filename with .tar.gz extension', () => {
      const osSpy = vi.spyOn(os, 'platform').mockReturnValue('linux');
      const archSpy = vi.spyOn(os, 'arch').mockReturnValue('x64');

      const result = commonPosix.makeNodeDistFileName('v18.20.0');
      expect(result).toBe('node-v18.20.0-linux-x64.tar.gz');

      osSpy.mockRestore();
      archSpy.mockRestore();
    });

    it('should create dist filename for darwin arm64', () => {
      const osSpy = vi.spyOn(os, 'platform').mockReturnValue('darwin');
      const archSpy = vi.spyOn(os, 'arch').mockReturnValue('arm64');

      const result = commonPosix.makeNodeDistFileName('v20.10.0');
      expect(result).toBe('node-v20.10.0-darwin-arm64.tar.gz');

      osSpy.mockRestore();
      archSpy.mockRestore();
    });
  });

  describe('dirHasNodeBin', () => {
    it('should check for node binary in bin subdirectory', async () => {
      commonPosix._exists.mockResolvedValue(true);

      const result = await commonPosix.dirHasNodeBin('/path/to/node/v18.20.0');

      expect(result).toBe(true);
      expect(commonPosix._exists).toHaveBeenCalledWith(
        path.join('/path/to/node/v18.20.0', 'bin', 'node')
      );
    });

    it('should return false when node binary does not exist', async () => {
      commonPosix._exists.mockResolvedValue(false);

      const result = await commonPosix.dirHasNodeBin('/path/to/empty');

      expect(result).toBe(false);
    });
  });

  describe('getSetInstallEnvScript', () => {
    it('should generate install env script with version and PATH', () => {
      process.env.PATH = '/usr/bin:/bin';

      const result = commonPosix.getSetInstallEnvScript('v18.20.0');

      expect(result).toContain("export PATH='/usr/bin:/bin'");
      expect(result).toContain("export NVM_INSTALL='v18.20.0'");
    });

    it('should single-quote PATH so metacharacters cannot execute', () => {
      process.env.PATH = '/path/with"quotes:/usr/bin';

      const result = commonPosix.getSetInstallEnvScript('v20.10.0');

      // value is wrapped in single quotes (POSIX-safe), not backslash-escaped
      expect(result).toContain(`export PATH='/path/with"quotes:/usr/bin'`);
      expect(result).toContain("export NVM_INSTALL='v20.10.0'");
    });
  });

  // These were three empty it.skip stubs citing "deep mocking of opfs". opfs was
  // dropped (90fb8f2) and this is now plain fs.promises against a real path, so
  // there is nothing left to mock -- a temp dir is enough.
  describe('createEnvironmentTmp', () => {
    const fs = require('fs');
    let envDir;

    beforeEach(() => {
      envDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nvm-envtmp-'));
    });

    afterEach(() => {
      fs.rmSync(envDir, { recursive: true, force: true });
    });

    it('should create environment file with default content', async () => {
      process.env.NVM_USE = '/nvm/v20.10.0/bin';
      process.env.PATH = '/nvm/v20.10.0/bin:/usr/bin';
      delete process.env.NVM_AUTO_USE_SHOWN_ERRORS;
      const target = path.join(envDir, 'nvm_env.sh');

      await commonPosix.createEnvironmentTmp(target);

      const out = fs.readFileSync(target, 'utf8');
      expect(out).toContain(`export NVM_USE='/nvm/v20.10.0/bin'`);
      expect(out).toContain(`export PATH='/nvm/v20.10.0/bin:/usr/bin'`);
      // the script is sourced by the shell, so it is written owner-only
      expect(fs.statSync(target).mode & 0o777).toBe(0o600);
    });

    it('should use custom content when provided', async () => {
      const target = path.join(envDir, 'nvm_env.sh');

      await commonPosix.createEnvironmentTmp(target, 'export CUSTOM=1\n');

      expect(fs.readFileSync(target, 'utf8')).toBe('export CUSTOM=1\n');
    });

    it('should handle empty NVM_USE', async () => {
      delete process.env.NVM_USE;
      const target = path.join(envDir, 'nvm_env.sh');

      await commonPosix.createEnvironmentTmp(target);

      expect(fs.readFileSync(target, 'utf8')).toContain(`export NVM_USE=''`);
    });

    // The write is temp-file + rename precisely so a shell sourcing this
    // predictable path never sees a partial script and a pre-planted symlink is
    // replaced rather than followed.
    it('leaves no temp file behind and replaces rather than follows a symlink', async () => {
      const real = path.join(envDir, 'attacker-target');
      const target = path.join(envDir, 'nvm_env.sh');
      fs.writeFileSync(real, 'original\n');
      fs.symlinkSync(real, target);

      await commonPosix.createEnvironmentTmp(target, 'export CUSTOM=1\n');

      expect(fs.lstatSync(target).isSymbolicLink()).toBe(false);
      expect(fs.readFileSync(real, 'utf8')).toBe('original\n');
      expect(fs.readdirSync(envDir).filter(n => n.endsWith('.tmp'))).toEqual([]);
    });
  });
});
