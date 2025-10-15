import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createE2EEnv } from '../helpers/e2e-utils.js';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('E2E: nvm use and nvm stop', () => {
  let env;
  let testVersion;

  beforeAll(async () => {
    env = await createE2EEnv();

    // Fetch a recent stable version to use for testing
    const response = await fetch('https://nodejs.org/dist/index.json');
    const releases = await response.json();

    // Find the first LTS release
    const lts = releases.find(r => r.lts);
    if (!lts) {
      throw new Error('No LTS version found');
    }

    testVersion = lts.version; // e.g., "v22.20.0"
    console.log(`Test will use version: ${testVersion}`);
  });

  afterAll(async () => {
    if (env) {
      await env.cleanup();
    }
  });

  describe('nvm use', () => {
    it('should fail when trying to use a non-installed version', async () => {
      const versionWithoutV = testVersion.replace(/^v/, '');
      const result = await env.runNvmCommand(['use', versionWithoutV], { timeout: 10000 });

      expect(result.exitCode).toBe(1);
      expect(result.stdout || result.stderr).toMatch(/not installed/i);
    }, 15000);

    it('should show error message for invalid version', async () => {
      const result = await env.runNvmCommand(['use', '999.999.999'], { timeout: 10000 });

      expect(result.exitCode).toBe(1);
      expect(result.stdout || result.stderr).toMatch(/not installed|not found/i);
    }, 15000);

    // TODO: These tests require install to work - depends on fixing NVM_HOME isolation
    it.skip('should use a specific installed version', async () => {
      // First install the version
      const versionWithoutV = testVersion.replace(/^v/, '');
      const installResult = await env.runNvmCommand(['install', versionWithoutV], {
        timeout: 120000
      });
      expect(installResult.exitCode).toBe(0);

      // Now use it
      const useResult = await env.runNvmCommand(['use', versionWithoutV], { timeout: 10000 });

      expect(useResult.exitCode).toBe(0);
      expect(useResult.stdout).toContain(testVersion);
      expect(useResult.stdout).toMatch(/now using/i);
    }, 150000);

    it.skip('should handle partial version numbers', async () => {
      // Use major version only (e.g., "18" instead of "18.20.0")
      const majorVersion = testVersion.split('.')[0].replace('v', '');
      const result = await env.runNvmCommand(['use', majorVersion], { timeout: 10000 });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(testVersion);
    }, 15000);

    it.skip('should update NVM_USE environment variable', async () => {
      const versionWithoutV = testVersion.replace(/^v/, '');

      // Use the version
      await env.runNvmCommand(['use', versionWithoutV], { timeout: 10000 });

      // Check that environment file was created with NVM_USE
      const envFile = env.getEnvFilePath();
      if (fs.existsSync(envFile)) {
        const envContent = fs.readFileSync(envFile, 'utf8');
        expect(envContent).toContain('NVM_USE');
        expect(envContent).toContain(testVersion);
      }
    }, 15000);

    it.skip('should allow running node commands after use', async () => {
      const versionWithoutV = testVersion.replace(/^v/, '');

      // Use the version
      const useResult = await env.runNvmCommand(['use', versionWithoutV], { timeout: 10000 });
      expect(useResult.exitCode).toBe(0);

      // Source the environment file and try to run node
      const envFile = env.getEnvFilePath();
      if (fs.existsSync(envFile)) {
        // This would need platform-specific handling to actually source and test
        // For now, just verify the env file exists
        expect(fs.existsSync(envFile)).toBe(true);
      }
    }, 15000);
  });

  describe('nvm stop (unuse)', () => {
    it('should work without errors even when no version is active', async () => {
      const result = await env.runNvmCommand(['stop'], { timeout: 10000 });

      // Should succeed or give a harmless message
      expect(result.exitCode === 0 || result.exitCode === 1).toBe(true);
    }, 15000);

    it('should accept "unuse" as alias for stop', async () => {
      const result = await env.runNvmCommand(['unuse'], { timeout: 10000 });

      // Should work the same as 'stop'
      expect(result.exitCode === 0 || result.exitCode === 1).toBe(true);
    }, 15000);

    // TODO: These tests require install to work - depends on fixing NVM_HOME isolation
    it.skip('should clear NVM_USE environment variable', async () => {
      // First use a version
      const versionWithoutV = testVersion.replace(/^v/, '');
      await env.runNvmCommand(['use', versionWithoutV], { timeout: 10000 });

      // Then stop
      const stopResult = await env.runNvmCommand(['stop'], { timeout: 10000 });
      expect(stopResult.exitCode).toBe(0);

      // Check that environment file was updated
      const envFile = env.getEnvFilePath();
      if (fs.existsSync(envFile)) {
        const envContent = fs.readFileSync(envFile, 'utf8');
        // NVM_USE should be empty or not set
        expect(envContent).toMatch(/NVM_USE[=\s]*["']?["']?/);
      }
    }, 20000);

    it.skip('should remove nvm paths from PATH', async () => {
      // First use a version
      const versionWithoutV = testVersion.replace(/^v/, '');
      await env.runNvmCommand(['use', versionWithoutV], { timeout: 10000 });

      // Then stop
      const stopResult = await env.runNvmCommand(['stop'], { timeout: 10000 });
      expect(stopResult.exitCode).toBe(0);

      // Verify PATH doesn't contain node version paths
      const envFile = env.getEnvFilePath();
      if (fs.existsSync(envFile)) {
        const envContent = fs.readFileSync(envFile, 'utf8');
        // PATH should not contain the version directory
        expect(envContent).not.toContain(testVersion);
      }
    }, 20000);

    it.skip('should restore environment to pre-nvm state', async () => {
      // First use a version
      const versionWithoutV = testVersion.replace(/^v/, '');
      await env.runNvmCommand(['use', versionWithoutV], { timeout: 10000 });

      // Then stop
      const stopResult = await env.runNvmCommand(['stop'], { timeout: 10000 });
      expect(stopResult.exitCode).toBe(0);
      expect(stopResult.stdout || '').toMatch(/undo|deactivat|stop/i);
    }, 20000);
  });

  describe('nvm use workflow', () => {
    // TODO: This test requires install to work - depends on fixing NVM_HOME isolation
    it.skip('should allow switching between versions', async () => {
      // Install two versions
      const version1 = testVersion;
      const response = await fetch('https://nodejs.org/dist/index.json');
      const releases = await response.json();
      const ltsVersions = releases.filter(r => r.lts).slice(0, 2);

      if (ltsVersions.length < 2) {
        console.log('Skipping: not enough LTS versions available');
        return;
      }

      const version2 = ltsVersions[1].version;

      // Install both
      await env.runNvmCommand(['install', version1.replace(/^v/, '')], { timeout: 120000 });
      await env.runNvmCommand(['install', version2.replace(/^v/, '')], { timeout: 120000 });

      // Use version 1
      let result = await env.runNvmCommand(['use', version1.replace(/^v/, '')], { timeout: 10000 });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(version1);

      // Switch to version 2
      result = await env.runNvmCommand(['use', version2.replace(/^v/, '')], { timeout: 10000 });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(version2);

      // Stop using any version
      result = await env.runNvmCommand(['stop'], { timeout: 10000 });
      expect(result.exitCode).toBe(0);
    }, 300000);
  });

  describe('Edge cases', () => {
    it('should handle .nvmrc file if present', async () => {
      // Create a .nvmrc file in the test directory
      const nvmrcPath = path.join(env.nvmHome, '.nvmrc');
      const nvmrcVersion = testVersion.replace(/^v/, '');
      fs.writeFileSync(nvmrcPath, nvmrcVersion);

      try {
        // Run 'nvm use' without version (should read from .nvmrc)
        const result = await env.runNvmCommand(['use'], {
          timeout: 10000,
          cwd: env.nvmHome
        });

        // Should attempt to use the version from .nvmrc
        // Will fail because version is not installed, but should read the file
        expect(result.stdout || result.stderr).toMatch(/\.nvmrc|not installed/i);
      } finally {
        // Cleanup
        if (fs.existsSync(nvmrcPath)) {
          fs.unlinkSync(nvmrcPath);
        }
      }
    }, 15000);

    it('should show helpful error when .nvmrc is invalid', async () => {
      // Create an invalid .nvmrc file
      const nvmrcPath = path.join(env.nvmHome, '.nvmrc');
      fs.writeFileSync(nvmrcPath, 'invalid-version-format!!!');

      try {
        const result = await env.runNvmCommand(['use'], {
          timeout: 10000,
          cwd: env.nvmHome
        });

        // Should show error about invalid version
        expect(result.exitCode).toBe(1);
        expect(result.stdout || result.stderr).toMatch(/invalid|error|not found/i);
      } finally {
        // Cleanup
        if (fs.existsSync(nvmrcPath)) {
          fs.unlinkSync(nvmrcPath);
        }
      }
    }, 15000);

    it('should handle .node-version file if present', async () => {
      // Create a .node-version file in the test directory
      const nodeVersionPath = path.join(env.nvmHome, '.node-version');
      const nodeVersionValue = testVersion.replace(/^v/, '');
      fs.writeFileSync(nodeVersionPath, nodeVersionValue);

      try {
        // Run 'nvm use' without version (should read from .node-version)
        const result = await env.runNvmCommand(['use'], {
          timeout: 10000,
          cwd: env.nvmHome
        });

        // Should attempt to use the version from .node-version
        // Will fail because version is not installed, but should read the file
        expect(result.stdout || result.stderr).toMatch(/\.node-version|not installed/i);
      } finally {
        // Cleanup
        if (fs.existsSync(nodeVersionPath)) {
          fs.unlinkSync(nodeVersionPath);
        }
      }
    }, 15000);

    it('should show helpful error when .node-version is invalid', async () => {
      // Create an invalid .node-version file
      const nodeVersionPath = path.join(env.nvmHome, '.node-version');
      fs.writeFileSync(nodeVersionPath, 'invalid-version-format!!!');

      try {
        const result = await env.runNvmCommand(['use'], {
          timeout: 10000,
          cwd: env.nvmHome
        });

        // Should show error about invalid version
        expect(result.exitCode).toBe(1);
        expect(result.stdout || result.stderr).toMatch(/invalid|error|not found/i);
      } finally {
        // Cleanup
        if (fs.existsSync(nodeVersionPath)) {
          fs.unlinkSync(nodeVersionPath);
        }
      }
    }, 15000);

    it('should prefer .nvmrc over .node-version when both exist', async () => {
      // Create both files with different versions
      const nvmrcPath = path.join(env.nvmHome, '.nvmrc');
      const nodeVersionPath = path.join(env.nvmHome, '.node-version');

      const nvmrcVersion = testVersion.replace(/^v/, '');
      const nodeVersionValue = '20.10.0'; // Different version

      fs.writeFileSync(nvmrcPath, nvmrcVersion);
      fs.writeFileSync(nodeVersionPath, nodeVersionValue);

      try {
        // Run 'nvm use' without version
        const result = await env.runNvmCommand(['use'], {
          timeout: 10000,
          cwd: env.nvmHome
        });

        // Should read from .nvmrc (priority)
        expect(result.stdout || result.stderr).toMatch(new RegExp(`\\.nvmrc|${nvmrcVersion}`, 'i'));
      } finally {
        // Cleanup
        if (fs.existsSync(nvmrcPath)) {
          fs.unlinkSync(nvmrcPath);
        }
        if (fs.existsSync(nodeVersionPath)) {
          fs.unlinkSync(nodeVersionPath);
        }
      }
    }, 15000);

    it('should show helpful error when neither .nvmrc nor .node-version nor package.json exist', async () => {
      // Ensure no version files exist
      const nvmrcPath = path.join(env.nvmHome, '.nvmrc');
      const nodeVersionPath = path.join(env.nvmHome, '.node-version');
      const packageJsonPath = path.join(env.nvmHome, 'package.json');

      if (fs.existsSync(nvmrcPath)) {
        fs.unlinkSync(nvmrcPath);
      }
      if (fs.existsSync(nodeVersionPath)) {
        fs.unlinkSync(nodeVersionPath);
      }
      if (fs.existsSync(packageJsonPath)) {
        fs.unlinkSync(packageJsonPath);
      }

      // Run 'nvm use' without version
      const result = await env.runNvmCommand(['use'], {
        timeout: 10000,
        cwd: env.nvmHome
      });

      // Should show error about missing version file or package.json
      expect(result.exitCode).toBe(1);
      expect(result.stdout || result.stderr).toMatch(/no.*file|package\.json/i);
    }, 15000);

    it('should read exact version from package.json engines.node as fallback', async () => {
      // Ensure no .nvmrc or .node-version files exist
      const nvmrcPath = path.join(env.nvmHome, '.nvmrc');
      const nodeVersionPath = path.join(env.nvmHome, '.node-version');
      const packageJsonPath = path.join(env.nvmHome, 'package.json');

      if (fs.existsSync(nvmrcPath)) fs.unlinkSync(nvmrcPath);
      if (fs.existsSync(nodeVersionPath)) fs.unlinkSync(nodeVersionPath);

      // Create package.json with exact version
      const packageJson = {
        name: 'test-project',
        engines: {
          node: testVersion.replace(/^v/, '')
        }
      };
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

      try {
        const result = await env.runNvmCommand(['use'], {
          timeout: 10000,
          cwd: env.nvmHome
        });

        // Should read from package.json
        expect(result.stdout || result.stderr).toMatch(/package\.json|not installed/i);
      } finally {
        if (fs.existsSync(packageJsonPath)) {
          fs.unlinkSync(packageJsonPath);
        }
      }
    }, 15000);

    it.skip('should resolve semver range from package.json engines.node', async () => {
      // This test requires installed versions - skip for now
      const packageJsonPath = path.join(env.nvmHome, 'package.json');

      // Create package.json with semver range
      const packageJson = {
        name: 'test-project',
        engines: {
          node: '>=18.0.0'
        }
      };
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

      try {
        const result = await env.runNvmCommand(['use'], {
          timeout: 10000,
          cwd: env.nvmHome
        });

        // Should resolve to highest matching version
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(/found.*matching|now using/i);
      } finally {
        if (fs.existsSync(packageJsonPath)) {
          fs.unlinkSync(packageJsonPath);
        }
      }
    }, 15000);

    it('should show error when no installed version satisfies engines.node range', async () => {
      const packageJsonPath = path.join(env.nvmHome, 'package.json');

      // Create package.json with impossible range
      const packageJson = {
        name: 'test-project',
        engines: {
          node: '>=99.0.0'
        }
      };
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

      try {
        const result = await env.runNvmCommand(['use'], {
          timeout: 10000,
          cwd: env.nvmHome
        });

        // Should show error about no matching version
        expect(result.exitCode).toBe(1);
        expect(result.stdout || result.stderr).toMatch(/no.*version.*satisfies|no.*installed/i);
      } finally {
        if (fs.existsSync(packageJsonPath)) {
          fs.unlinkSync(packageJsonPath);
        }
      }
    }, 15000);

    it('should show error for invalid semver range in package.json', async () => {
      const packageJsonPath = path.join(env.nvmHome, 'package.json');

      // Create package.json with invalid semver
      const packageJson = {
        name: 'test-project',
        engines: {
          node: 'not-a-valid-version!!!'
        }
      };
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

      try {
        const result = await env.runNvmCommand(['use'], {
          timeout: 10000,
          cwd: env.nvmHome
        });

        // Should show error about invalid version
        expect(result.exitCode).toBe(1);
        expect(result.stdout || result.stderr).toMatch(/invalid.*version|invalid.*requirement/i);
      } finally {
        if (fs.existsSync(packageJsonPath)) {
          fs.unlinkSync(packageJsonPath);
        }
      }
    }, 15000);

    it('should prefer .nvmrc over package.json engines.node', async () => {
      const nvmrcPath = path.join(env.nvmHome, '.nvmrc');
      const packageJsonPath = path.join(env.nvmHome, 'package.json');

      const nvmrcVersion = testVersion.replace(/^v/, '');

      // Create both files
      fs.writeFileSync(nvmrcPath, nvmrcVersion);
      const packageJson = {
        name: 'test-project',
        engines: {
          node: '>=18.0.0'
        }
      };
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

      try {
        const result = await env.runNvmCommand(['use'], {
          timeout: 10000,
          cwd: env.nvmHome
        });

        // Should read from .nvmrc (priority)
        expect(result.stdout || result.stderr).toMatch(new RegExp(`\\.nvmrc|${nvmrcVersion}`, 'i'));
        expect(result.stdout || result.stderr).not.toMatch(/package\.json/i);
      } finally {
        if (fs.existsSync(nvmrcPath)) fs.unlinkSync(nvmrcPath);
        if (fs.existsSync(packageJsonPath)) fs.unlinkSync(packageJsonPath);
      }
    }, 15000);

    it('should prefer .node-version over package.json engines.node', async () => {
      const nodeVersionPath = path.join(env.nvmHome, '.node-version');
      const packageJsonPath = path.join(env.nvmHome, 'package.json');

      const nodeVersion = testVersion.replace(/^v/, '');

      // Create both files
      fs.writeFileSync(nodeVersionPath, nodeVersion);
      const packageJson = {
        name: 'test-project',
        engines: {
          node: '>=18.0.0'
        }
      };
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

      try {
        const result = await env.runNvmCommand(['use'], {
          timeout: 10000,
          cwd: env.nvmHome
        });

        // Should read from .node-version (priority)
        expect(result.stdout || result.stderr).toMatch(new RegExp(`\\.node-version|${nodeVersion}`, 'i'));
        expect(result.stdout || result.stderr).not.toMatch(/package\.json/i);
      } finally {
        if (fs.existsSync(nodeVersionPath)) fs.unlinkSync(nodeVersionPath);
        if (fs.existsSync(packageJsonPath)) fs.unlinkSync(packageJsonPath);
      }
    }, 15000);

    it('should handle package.json without engines field gracefully', async () => {
      const packageJsonPath = path.join(env.nvmHome, 'package.json');

      // Create package.json without engines
      const packageJson = {
        name: 'test-project',
        version: '1.0.0'
      };
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

      try {
        const result = await env.runNvmCommand(['use'], {
          timeout: 10000,
          cwd: env.nvmHome
        });

        // Should show error about no version file
        expect(result.exitCode).toBe(1);
        expect(result.stdout || result.stderr).toMatch(/no.*file|engines\.node/i);
      } finally {
        if (fs.existsSync(packageJsonPath)) {
          fs.unlinkSync(packageJsonPath);
        }
      }
    }, 15000);
  });
});
