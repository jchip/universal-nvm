import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createE2EEnv } from '../helpers/e2e-utils.js';

describe('E2E: Installation and Basic Commands', () => {
  let env;
  let ltsVersion;

  beforeAll(async () => {
    env = await createE2EEnv();

    // Fetch current LTS version from Node.js releases
    const response = await fetch('https://nodejs.org/dist/index.json');
    const releases = await response.json();

    // Find the first LTS release
    const lts = releases.find(r => r.lts);
    if (!lts) {
      throw new Error('No LTS version found');
    }

    ltsVersion = lts.version; // e.g., "v22.20.0"
    console.log(`Using LTS version: ${ltsVersion}`);
  });

  afterAll(async () => {
    if (env) {
      await env.cleanup();
    }
  });

  describe('Environment Setup', () => {
    it('should create test environment successfully', () => {
      expect(env.nvmHome).toBeTruthy();
      expect(env.nvmHome).toContain('nvm-e2e-');
    });

    it('should have dist/nvm.js copied', () => {
      const fs = require('fs');
      const path = require('path');
      const distFile = path.join(env.nvmHome, 'dist', 'nvm.js');
      expect(fs.existsSync(distFile)).toBe(true);
    });
  });

  describe('nvm ls-remote', () => {
    it('should list remote versions', async () => {
      const result = await env.runNvmCommand(['ls-remote'], { timeout: 30000 });

      if (result.exitCode !== 0) {
        console.error('Command failed with exit code:', result.exitCode);
        console.error('stdout:', result.stdout);
        console.error('stderr:', result.stderr);
      }

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/v\d+\.\d+\.\d+/);
      // Output contains multiple versions
      expect(result.stdout.split('\n').length).toBeGreaterThan(10);
    }, 35000);

    it('should filter to show only recent versions', async () => {
      // ls-remote doesn't take arguments, just verify it returns versions
      const result = await env.runNvmCommand(['ls-remote'], { timeout: 30000 });

      if (result.exitCode !== 0) {
        console.error('Command failed with exit code:', result.exitCode);
        console.error('stdout:', result.stdout);
        console.error('stderr:', result.stderr);
      }

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/v\d+\.\d+\.\d+/);

      // Should have many versions
      const versionLines = result.stdout.split('\n').filter(line => line.match(/^v\d+/));
      expect(versionLines.length).toBeGreaterThan(50);
    }, 35000);
  });

  // TODO: Fix install tests - NVM_HOME environment variable not properly isolated in CI
  describe.skip('nvm install', () => {
    it('should install a specific Node.js version', async () => {
      // Install current LTS version (dynamically fetched)
      const versionWithoutV = ltsVersion.replace(/^v/, '');
      const result = await env.runNvmCommand(['install', versionWithoutV], { timeout: 120000 });

      if (result.exitCode !== 0) {
        console.error('Install command failed with exit code:', result.exitCode);
        console.error('stdout:', result.stdout);
        console.error('stderr:', result.stderr);
      }

      // Check command succeeded
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(ltsVersion);

      // Verify version directory was created
      const isInstalled = env.isVersionInstalled(ltsVersion);
      if (!isInstalled) {
        console.error('Version not found. NVM_HOME:', env.nvmHome);
        console.error('Installed versions:', env.getInstalledVersions());
        console.error('Install stdout:', result.stdout);
        console.error('Install stderr:', result.stderr);

        // List directory contents for debugging
        const fs = require('fs');
        if (fs.existsSync(env.nvmHome)) {
          console.error('NVM_HOME contents:', fs.readdirSync(env.nvmHome));
        }
      }
      expect(isInstalled).toBe(true);

      // Verify version appears in installed list
      const versions = env.getInstalledVersions();
      expect(versions).toContain(ltsVersion);
    }, 150000);

    it('should install latest LTS version', async () => {
      const result = await env.runNvmCommand(['install', 'lts'], { timeout: 120000 });

      // Accept exit code 0 (success) or 1 (already installed)
      const isAlreadyInstalled = result.stdout.includes('already installed');
      if (result.exitCode !== 0 && !isAlreadyInstalled) {
        console.error('Install LTS failed with exit code:', result.exitCode);
        console.error('stdout:', result.stdout);
        console.error('stderr:', result.stderr);
      }

      // Either succeeds or reports already installed
      expect(result.exitCode === 0 || isAlreadyInstalled).toBe(true);
      expect(result.stdout).toMatch(/v\d+\.\d+\.\d+/);

      // At least one version should be installed (we installed LTS previously)
      const versions = env.getInstalledVersions();
      if (versions.length === 0) {
        console.error('No versions installed. NVM_HOME:', env.nvmHome);
        const fs = require('fs');
        if (fs.existsSync(env.nvmHome)) {
          console.error('NVM_HOME contents:', fs.readdirSync(env.nvmHome));
        }
      }
      expect(versions.length).toBeGreaterThan(0);
    }, 150000);
  });

  describe.skip('nvm ls', () => {
    it('should list installed versions', async () => {
      const result = await env.runNvmCommand(['ls'], { timeout: 10000 });

      expect(result.exitCode).toBe(0);

      // Should show the LTS version that we installed earlier
      expect(result.stdout).toContain(ltsVersion);
    }, 15000);
  });

  describe.skip('nvm link', () => {
    it('should link a Node.js version as default', async () => {
      const versionWithoutV = ltsVersion.replace(/^v/, '');
      const result = await env.runNvmCommand(['link', versionWithoutV], { timeout: 30000 });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(ltsVersion);

      // Verify symlink was created
      const linkedVersion = env.getLinkedVersion();
      expect(linkedVersion).toBe(ltsVersion);
    }, 35000);

    it('should show linked version in ls output', async () => {
      const result = await env.runNvmCommand(['ls'], { timeout: 10000 });

      expect(result.exitCode).toBe(0);
      // The linked version should be marked (implementation specific)
      expect(result.stdout).toContain(ltsVersion);
    }, 15000);
  });

  describe.skip('nvm unlink', () => {
    it('should unlink the default version', async () => {
      const result = await env.runNvmCommand(['unlink'], { timeout: 10000 });

      expect(result.exitCode).toBe(0);

      // Verify symlink was removed
      const linkedVersion = env.getLinkedVersion();
      expect(linkedVersion).toBeNull();
    }, 15000);
  });

  describe.skip('nvm uninstall', () => {
    it('should uninstall a Node.js version', async () => {
      // First verify it's installed
      expect(env.isVersionInstalled(ltsVersion)).toBe(true);

      const versionWithoutV = ltsVersion.replace(/^v/, '');
      const result = await env.runNvmCommand(['uninstall', versionWithoutV], { timeout: 30000 });

      expect(result.exitCode).toBe(0);

      // Verify version directory was removed
      expect(env.isVersionInstalled(ltsVersion)).toBe(false);

      // Verify version doesn't appear in installed list
      const versions = env.getInstalledVersions();
      expect(versions).not.toContain(ltsVersion);
    }, 35000);
  });
});
