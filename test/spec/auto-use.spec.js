import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

const autoUse = require('../../lib/auto-use');
const common = require('../../lib/common');

describe('Auto-use functionality', () => {
  let testDir;
  let originalCwd;
  let originalEnv;

  beforeEach(async () => {
    // Save original state
    originalCwd = process.cwd();
    originalEnv = { ...process.env };

    // Create a temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nvm-auto-use-test-'));
    process.chdir(testDir);

    // Mock common.findLocalVersions to return test versions
    vi.spyOn(common, 'findLocalVersions').mockResolvedValue([
      'v18.19.0',
      'v20.10.0',
      'v20.11.1',
      'v22.0.0'
    ]);

    // Mock common.findNodeVersion
    vi.spyOn(common, 'findNodeVersion').mockImplementation(async (ver) => {
      const version = 'v' + ver.replace(/^v/, '');
      return {
        version,
        nodeDir: `/fake/path/${version}`
      };
    });

    // Mock common.findLinkVersion
    vi.spyOn(common, 'findLinkVersion').mockResolvedValue(null);

    // Mock common.resetNvmPaths
    vi.spyOn(common, 'resetNvmPaths').mockResolvedValue(undefined);

    // Mock common.setNvmUsePath
    vi.spyOn(common, 'setNvmUsePath').mockImplementation(() => {});

    // Mock common.createEnvironmentTmp
    vi.spyOn(common, 'createEnvironmentTmp').mockResolvedValue(undefined);

    // Mock common.log to suppress output
    vi.spyOn(common, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    // Restore original state
    process.chdir(originalCwd);
    process.env = originalEnv;
    vi.restoreAllMocks();

    // Clear error tracking between tests
    autoUse._clearShownErrors();

    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  describe('No version file', () => {
    it('should return null when no version file exists', async () => {
      const result = await autoUse();
      expect(result).toBeNull();
    });

    it('should not switch versions when no version file exists', async () => {
      await autoUse();
      expect(common.setNvmUsePath).not.toHaveBeenCalled();
    });
  });

  describe('.nvmrc file', () => {
    it('should detect and use version from .nvmrc', async () => {
      await fs.writeFile(path.join(testDir, '.nvmrc'), '20.10.0');

      const result = await autoUse({ silent: false });

      expect(result).not.toBeNull();
      expect(result.version).toBe('v20.10.0');
      expect(result.switched).toBe(true);
      expect(result.source).toBe('.nvmrc');
    });

    it('should handle .nvmrc with v prefix', async () => {
      await fs.writeFile(path.join(testDir, '.nvmrc'), 'v20.10.0');

      const result = await autoUse({ silent: false });

      expect(result).not.toBeNull();
      expect(result.version).toBe('v20.10.0');
    });

    it('should handle .nvmrc with whitespace', async () => {
      await fs.writeFile(path.join(testDir, '.nvmrc'), '  20.10.0  \n');

      const result = await autoUse({ silent: false });

      expect(result).not.toBeNull();
      expect(result.version).toBe('v20.10.0');
    });

    it('should return null for invalid version in .nvmrc', async () => {
      await fs.writeFile(path.join(testDir, '.nvmrc'), 'invalid-version');

      const result = await autoUse({ silent: false });

      expect(result).toBeNull();
    });
  });

  describe('.node-version file', () => {
    it('should detect and use version from .node-version', async () => {
      await fs.writeFile(path.join(testDir, '.node-version'), '18.19.0');

      const result = await autoUse({ silent: false });

      expect(result).not.toBeNull();
      expect(result.version).toBe('v18.19.0');
      expect(result.source).toBe('.node-version');
    });

    it('should prefer .nvmrc over .node-version', async () => {
      await fs.writeFile(path.join(testDir, '.nvmrc'), '20.10.0');
      await fs.writeFile(path.join(testDir, '.node-version'), '18.19.0');

      const result = await autoUse({ silent: false });

      expect(result.version).toBe('v20.10.0');
      expect(result.source).toBe('.nvmrc');
    });
  });

  describe('package.json engines.node', () => {
    it('should detect and use exact version from package.json', async () => {
      const packageJson = {
        name: 'test',
        engines: { node: '20.10.0' }
      };
      await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify(packageJson));

      const result = await autoUse({ silent: false });

      expect(result).not.toBeNull();
      expect(result.version).toBe('v20.10.0');
      expect(result.source).toBe('package.json');
    });

    it('should match semver range from package.json', async () => {
      const packageJson = {
        name: 'test',
        engines: { node: '>=20.0.0' }
      };
      await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify(packageJson));

      const result = await autoUse({ silent: false });

      expect(result).not.toBeNull();
      expect(result.version).toBe('v22.0.0'); // Should pick highest matching version
      expect(result.source).toBe('package.json');
    });

    it('should match caret range from package.json', async () => {
      const packageJson = {
        name: 'test',
        engines: { node: '^20.10.0' }
      };
      await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify(packageJson));

      const result = await autoUse({ silent: false });

      expect(result).not.toBeNull();
      expect(result.version).toBe('v20.11.1'); // Should pick highest 20.x version
    });

    it('should prefer .nvmrc over package.json', async () => {
      await fs.writeFile(path.join(testDir, '.nvmrc'), '18.19.0');
      const packageJson = {
        name: 'test',
        engines: { node: '20.10.0' }
      };
      await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify(packageJson));

      const result = await autoUse({ silent: false });

      expect(result.version).toBe('v18.19.0');
      expect(result.source).toBe('.nvmrc');
    });

    it('should handle package.json without engines field', async () => {
      const packageJson = { name: 'test' };
      await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify(packageJson));

      const result = await autoUse();

      expect(result).toBeNull();
    });

    it('should handle invalid package.json', async () => {
      await fs.writeFile(path.join(testDir, 'package.json'), 'invalid json{');

      const result = await autoUse();

      expect(result).toBeNull();
    });
  });

  describe('Already using correct version', () => {
    it('should not switch if already using the correct version', async () => {
      await fs.writeFile(path.join(testDir, '.nvmrc'), '20.10.0');
      process.env.NVM_USE = 'v20.10.0';

      const result = await autoUse({ silent: false });

      expect(result).not.toBeNull();
      expect(result.switched).toBe(false);
      expect(common.setNvmUsePath).not.toHaveBeenCalled();
    });

    it('should switch if using different version', async () => {
      await fs.writeFile(path.join(testDir, '.nvmrc'), '20.10.0');
      process.env.NVM_USE = 'v18.19.0';

      const result = await autoUse({ silent: false });

      expect(result).not.toBeNull();
      expect(result.switched).toBe(true);
      expect(common.setNvmUsePath).toHaveBeenCalled();
    });
  });

  describe('Version not installed', () => {
    it('should return null if requested version is not installed', async () => {
      await fs.writeFile(path.join(testDir, '.nvmrc'), '16.0.0');

      // Mock findNodeVersion to throw for version 16
      common.findNodeVersion.mockImplementation(() => {
        throw new Error('Version not found');
      });

      const result = await autoUse();

      expect(result).toBeNull();
      expect(common.setNvmUsePath).not.toHaveBeenCalled();
    });

    it('should show error once when version not installed (even in silent mode)', async () => {
      await fs.writeFile(path.join(testDir, '.nvmrc'), '16.0.0');

      // Mock findNodeVersion to throw for version 16
      common.findNodeVersion.mockImplementation(() => {
        throw new Error('Version not found');
      });

      // First call - should show error
      await autoUse({ silent: true });
      expect(common.log).toHaveBeenCalledTimes(1);
      expect(common.log).toHaveBeenCalledWith(expect.stringContaining('16.0.0'));
      expect(common.log).toHaveBeenCalledWith(expect.stringContaining('not installed'));

      // Reset mock to check second call
      common.log.mockClear();

      // Second call - should NOT show error again
      await autoUse({ silent: true });
      expect(common.log).not.toHaveBeenCalled();
    });
  });

  describe('Silent and verbose modes', () => {
    it('should still show version switch in silent mode', async () => {
      await fs.writeFile(path.join(testDir, '.nvmrc'), '20.10.0');

      await autoUse({ silent: true });

      // Silent mode suppresses "not found" but still shows version switches
      expect(common.log).toHaveBeenCalled();
    });

    it('should show output in non-silent mode', async () => {
      await fs.writeFile(path.join(testDir, '.nvmrc'), '20.10.0');

      await autoUse({ silent: false });

      expect(common.log).toHaveBeenCalled();
    });

    it('should show detailed output in verbose mode', async () => {
      await fs.writeFile(path.join(testDir, '.nvmrc'), '20.10.0');

      await autoUse({ silent: false, verbose: true });

      expect(common.log).toHaveBeenCalled();
    });

    it('should not log when already using version (silent behavior)', async () => {
      await fs.writeFile(path.join(testDir, '.nvmrc'), '20.10.0');
      process.env.NVM_USE = 'v20.10.0';

      const result = await autoUse({ silent: false, verbose: true });

      // Should return result but not log anything (silent when already using)
      expect(result).not.toBeNull();
      expect(result.switched).toBe(false);
      expect(common.log).not.toHaveBeenCalled();
    });
  });
});
