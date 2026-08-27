import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockXaa = {
  delay: vi.fn()
};

vi.mock('xaa', () => mockXaa);

const os = require('os');
const path = require('path');

describe('common-win32 utility functions', () => {
  let commonWin32;
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };

    // Clear module cache to get fresh instance
    delete require.cache[require.resolve('../../lib/common-win32')];
    commonWin32 = require('../../lib/common-win32');

    // Add mock functions
    commonWin32._exists = vi.fn();
    commonWin32.getTmpdir = vi.fn(() => 'C:\\Temp');
    commonWin32.getEnvFile = vi.fn((ext) => `nvm_env${ext}`);

    // Reset mocks
    mockXaa.delay.mockClear();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // Previously four empty it.skip stubs blaming "deep mocking of opfs"; opfs is
  // gone (90fb8f2) and this is fs.promises.rename plus retry bookkeeping, so a
  // single spy covers every branch. The EPERM retry exists because Windows
  // virus scanners and the indexer briefly hold a handle on a freshly extracted
  // dir -- a race that E2E cannot reproduce on demand, so unit coverage is the
  // only coverage it gets.
  describe('rename', () => {
    const fs = require('fs');
    // NOTE: the vi.mock('xaa') at the top of this file does not intercept the
    // CJS require inside lib/common-win32.js -- the real module is used. Spy on
    // that same module object instead, which also keeps the backoff from
    // actually sleeping through the retry tests.
    const xaa = require('xaa');
    const epermError = () => Object.assign(new Error('EPERM'), { code: 'EPERM' });
    let delaySpy;

    beforeEach(() => {
      delaySpy = vi.spyOn(xaa, 'delay').mockResolvedValue(undefined);
    });

    it('should rename file successfully', async () => {
      const spy = vi.spyOn(fs.promises, 'rename').mockResolvedValue(undefined);

      await commonWin32.rename('from.txt', 'to.txt');

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('from.txt', 'to.txt');
      expect(delaySpy).not.toHaveBeenCalled();
    });

    it('should retry on EPERM error', async () => {
      const spy = vi
        .spyOn(fs.promises, 'rename')
        .mockRejectedValueOnce(epermError())
        .mockRejectedValueOnce(epermError())
        .mockResolvedValue(undefined);

      await commonWin32.rename('from.txt', 'to.txt');

      expect(spy).toHaveBeenCalledTimes(3);
      expect(delaySpy).toHaveBeenCalledTimes(2);
      expect(delaySpy).toHaveBeenCalledWith(50);
    });

    it('should throw non-EPERM errors immediately', async () => {
      const enoent = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      const spy = vi.spyOn(fs.promises, 'rename').mockRejectedValue(enoent);

      await expect(commonWin32.rename('from.txt', 'to.txt')).rejects.toThrow('ENOENT');

      expect(spy).toHaveBeenCalledTimes(1);
      expect(delaySpy).not.toHaveBeenCalled();
    });

    it('should throw EPERM after max retries', async () => {
      const spy = vi.spyOn(fs.promises, 'rename').mockRejectedValue(epermError());

      await expect(commonWin32.rename('from.txt', 'to.txt')).rejects.toThrow('EPERM');

      // initial attempt plus retryCount 1..5, then it gives up
      expect(spy).toHaveBeenCalledTimes(6);
      expect(delaySpy).toHaveBeenCalledTimes(5);
    });
  });

  describe('getNodeBinDir', () => {
    it('should return nodeDir as-is on Windows', () => {
      const result = commonWin32.getNodeBinDir('C:\\nvm\\nodejs\\v18.20.0');
      expect(result).toBe('C:\\nvm\\nodejs\\v18.20.0');
    });

    it('should handle paths with forward slashes', () => {
      const result = commonWin32.getNodeBinDir('C:/nvm/nodejs/v20.10.0');
      expect(result).toBe('C:/nvm/nodejs/v20.10.0');
    });
  });

  describe('makeNodeDistName', () => {
    it('should create dist name for x64 architecture', () => {
      const archSpy = vi.spyOn(os, 'arch').mockReturnValue('x64');

      const result = commonWin32.makeNodeDistName('v18.20.0');
      expect(result).toBe('node-v18.20.0-win-x64');

      archSpy.mockRestore();
    });

    it('should create dist name for x86 architecture', () => {
      const archSpy = vi.spyOn(os, 'arch').mockReturnValue('x86');

      const result = commonWin32.makeNodeDistName('v14.21.3');
      expect(result).toBe('node-v14.21.3-win-x86');

      archSpy.mockRestore();
    });

    it('should handle uppercase architecture', () => {
      const archSpy = vi.spyOn(os, 'arch').mockReturnValue('X64');

      const result = commonWin32.makeNodeDistName('v20.10.0');
      expect(result).toBe('node-v20.10.0-win-x64');

      archSpy.mockRestore();
    });

    it('should handle ia32 as x86', () => {
      const archSpy = vi.spyOn(os, 'arch').mockReturnValue('ia32');

      const result = commonWin32.makeNodeDistName('v16.20.0');
      expect(result).toBe('node-v16.20.0-win-x86');

      archSpy.mockRestore();
    });

    it('should select win-arm64 on arm64 for versions with an arm64 build (>= v19.9.0)', () => {
      const archSpy = vi.spyOn(os, 'arch').mockReturnValue('arm64');

      expect(commonWin32.makeNodeDistName('v20.10.0')).toBe('node-v20.10.0-win-arm64');
      expect(commonWin32.makeNodeDistName('v19.9.0')).toBe('node-v19.9.0-win-arm64');

      archSpy.mockRestore();
    });

    it('should fall back to x64 on arm64 for versions without an arm64 build (< v19.9.0)', () => {
      const archSpy = vi.spyOn(os, 'arch').mockReturnValue('arm64');

      expect(commonWin32.makeNodeDistName('v18.20.0')).toBe('node-v18.20.0-win-x64');
      expect(commonWin32.makeNodeDistName('v19.8.1')).toBe('node-v19.8.1-win-x64');

      archSpy.mockRestore();
    });
  });

  describe('cacheFileName', () => {
    it('should return node.zip', () => {
      expect(commonWin32.cacheFileName()).toBe('node.zip');
    });
  });

  describe('makeNodeDistFileName', () => {
    it('should create dist filename with .zip extension', () => {
      const archSpy = vi.spyOn(os, 'arch').mockReturnValue('x64');

      const result = commonWin32.makeNodeDistFileName('v18.20.0');
      expect(result).toBe('node-v18.20.0-win-x64.zip');

      archSpy.mockRestore();
    });

    it('should create x86 dist filename', () => {
      const archSpy = vi.spyOn(os, 'arch').mockReturnValue('x86');

      const result = commonWin32.makeNodeDistFileName('v14.21.3');
      expect(result).toBe('node-v14.21.3-win-x86.zip');

      archSpy.mockRestore();
    });
  });

  describe('dirHasNodeBin', () => {
    it('should check for node.exe in directory', async () => {
      commonWin32._exists.mockResolvedValue(true);

      const result = await commonWin32.dirHasNodeBin('C:\\nvm\\nodejs\\v18.20.0');

      expect(result).toBe(true);
      expect(commonWin32._exists).toHaveBeenCalledWith(
        path.join('C:\\nvm\\nodejs\\v18.20.0', 'node.exe')
      );
    });

    it('should return false when node.exe does not exist', async () => {
      commonWin32._exists.mockResolvedValue(false);

      const result = await commonWin32.dirHasNodeBin('C:\\empty');

      expect(result).toBe(false);
    });
  });

  describe('getSetInstallEnvScript', () => {
    it('should generate PowerShell script when NVM_POWERSHELL is set', () => {
      process.env.NVM_POWERSHELL = '1';
      process.env.PATH = 'C:\\Windows\\System32';

      const result = commonWin32.getSetInstallEnvScript('v18.20.0');

      expect(result).toContain("$Env:NVM_INSTALL='v18.20.0'");
      expect(result).toContain("$Env:Path='C:\\Windows\\System32'");
      expect(result).toContain('\r');
    });

    it('should generate CMD script when NVM_POWERSHELL is not set', () => {
      delete process.env.NVM_POWERSHELL;
      process.env.PATH = 'C:\\Windows\\System32';

      const result = commonWin32.getSetInstallEnvScript('v20.10.0');

      expect(result).toContain('@ECHO OFF');
      expect(result).toContain('SET "NVM_INSTALL=v20.10.0"');
      expect(result).toContain('SET "PATH=C:\\Windows\\System32"');
      expect(result).toContain('\r');
    });
  });

  describe('getDefaultEnvScript', () => {
    it('should generate PowerShell script with NVM_USE', () => {
      process.env.NVM_POWERSHELL = '1';
      process.env.NVM_USE = 'v18.20.0';
      process.env.PATH = 'C:\\nvm\\nodejs\\bin';

      const result = commonWin32.getDefaultEnvScript();

      expect(result).toContain("$Env:NVM_USE='v18.20.0'");
      expect(result).toContain("$Env:Path='C:\\nvm\\nodejs\\bin'");
    });

    it('should generate CMD script with NVM_USE', () => {
      delete process.env.NVM_POWERSHELL;
      process.env.NVM_USE = 'v20.10.0';
      process.env.PATH = 'C:\\nvm\\nodejs\\bin';

      const result = commonWin32.getDefaultEnvScript();

      expect(result).toContain('@ECHO OFF');
      expect(result).toContain('SET "NVM_USE=v20.10.0"');
      expect(result).toContain('SET "PATH=C:\\nvm\\nodejs\\bin"');
    });

    it('should handle empty NVM_USE', () => {
      delete process.env.NVM_POWERSHELL;
      delete process.env.NVM_USE;
      process.env.PATH = 'C:\\Windows\\System32';

      const result = commonWin32.getDefaultEnvScript();

      expect(result).toContain('SET "NVM_USE="');
    });
  });

  // Four more ex-stubs; same stale opfs reason. Runs on any platform because the
  // function only picks a filename and writes it -- no Windows API involved.
  describe('createEnvironmentTmp', () => {
    const fs = require('fs');
    let envDir;

    beforeEach(() => {
      envDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nvm-win32-envtmp-'));
      commonWin32.getTmpdir = vi.fn(() => envDir);
    });

    afterEach(() => {
      delete process.env.NVM_POWERSHELL;
      fs.rmSync(envDir, { recursive: true, force: true });
    });

    it('should create PowerShell environment file', async () => {
      process.env.NVM_POWERSHELL = '1';

      await commonWin32.createEnvironmentTmp();

      expect(commonWin32.getEnvFile).toHaveBeenCalledWith('.ps1');
      expect(fs.existsSync(path.join(envDir, 'nvm_env.ps1'))).toBe(true);
    });

    it('should create CMD environment file', async () => {
      delete process.env.NVM_POWERSHELL;

      await commonWin32.createEnvironmentTmp();

      expect(commonWin32.getEnvFile).toHaveBeenCalledWith('.cmd');
      expect(fs.existsSync(path.join(envDir, 'nvm_env.cmd'))).toBe(true);
    });

    it('should use custom content when provided', async () => {
      await commonWin32.createEnvironmentTmp(undefined, 'SET "CUSTOM=1"\n');

      expect(fs.readFileSync(path.join(envDir, 'nvm_env.cmd'), 'utf8')).toBe('SET "CUSTOM=1"\n');
    });

    it('should use custom file path when provided', async () => {
      const target = path.join(envDir, 'custom-env.cmd');

      await commonWin32.createEnvironmentTmp(target, 'SET "CUSTOM=1"\n');

      expect(fs.readFileSync(target, 'utf8')).toBe('SET "CUSTOM=1"\n');
      expect(fs.existsSync(path.join(envDir, 'nvm_env.cmd'))).toBe(false);
    });
  });

  describe('_newPathCmd (PATH registry rewrite)', () => {
    it('writes via reg.exe and never setx, so a >1024-char Path is not truncated', () => {
      const long = Array.from(
        { length: 60 },
        (_, i) => `C:\\dir_${i}_padding_padding_padding_padding`
      ).join(';');
      const cmd = commonWin32._newPathCmd(long, true, true);

      expect(cmd).toContain('reg.exe add');
      expect(cmd).not.toMatch(/setx/i);
      // the last (far past 1024 chars) entry survives -> no truncation
      expect(cmd).toContain('C:\\dir_59_padding_padding_padding_padding');
    });

    it('escapes % so REG_EXPAND_SZ references stay literal instead of expanding', () => {
      const cmd = commonWin32._newPathCmd('%USERPROFILE%\\bin', true, true);
      expect(cmd).toContain('%%USERPROFILE%%');
    });

    it('refuses to rewrite when the query succeeded but parsed no value (no wipe)', () => {
      // readOk=true + empty value == parse miss on a populated Path -> must not clobber
      const cmd = commonWin32._newPathCmd('', true, true);
      expect(cmd).not.toContain('reg.exe add');
      expect(cmd.toLowerCase()).toContain('skipped');
    });

    it('creates the nvm Path when the user genuinely has no Path value', () => {
      // readOk=false == reg.exe reported the value absent -> safe to create
      const cmd = commonWin32._newPathCmd('', true, false);
      expect(cmd).toContain('reg.exe add');
    });
  });
});
