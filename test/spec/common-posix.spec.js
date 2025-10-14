import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the dependencies before requiring the module
const mockOpfs = {};
const mockLog = vi.fn();

vi.mock('opfs', () => mockOpfs);

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

      expect(result).toContain('export PATH=');
      expect(result).toContain('export NVM_INSTALL=v18.20.0');
    });

    it('should escape quotes in PATH', () => {
      process.env.PATH = '/path/with"quotes:/usr/bin';

      const result = commonPosix.getSetInstallEnvScript('v20.10.0');

      expect(result).toContain('\\"');
      expect(result).toContain('export NVM_INSTALL=v20.10.0');
    });
  });

  describe('createEnvironmentTmp', () => {
    // Skip these tests as they require deep mocking of opfs which is complex
    // The functionality is tested via E2E tests
    it.skip('should create environment file with default content', async () => {
      // This test requires complex mocking of opfs module
      // Tested via E2E tests instead
    });

    it.skip('should use custom content when provided', async () => {
      // This test requires complex mocking of opfs module
      // Tested via E2E tests instead
    });

    it.skip('should handle empty NVM_USE', async () => {
      // This test requires complex mocking of opfs module
      // Tested via E2E tests instead
    });
  });
});
