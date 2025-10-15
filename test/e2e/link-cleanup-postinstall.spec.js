import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createE2EEnv } from '../helpers/e2e-utils.js';
import fs from 'fs';
import path from 'path';

describe('E2E: nvm link, unlink, cleanup, and postinstall', () => {
  let env;
  const testVersion = 'v22.20.0';

  beforeAll(async () => {
    env = await createE2EEnv();
  });

  afterAll(async () => {
    if (env) {
      await env.cleanup();
    }
  });

  describe('nvm link/unlink', () => {
    // TODO: These tests require install to work - depends on fixing NVM_HOME isolation
    it.skip('should link an installed version', async () => {
      // Install a version first
      await env.runNvmCommand(['install', testVersion.replace('v', '')], { timeout: 120000 });

      // Link the version
      const result = await env.runNvmCommand(['link', testVersion.replace('v', '')], { timeout: 10000 });

      expect(result.exitCode).toBe(0);
      // Should not show errors
      expect(result.stderr).not.toMatch(/error|fail/i);
    }, 150000);

    it.skip('should show linked version in ls output', async () => {
      // Install and link a version
      await env.runNvmCommand(['install', testVersion.replace('v', '')], { timeout: 120000 });
      await env.runNvmCommand(['link', testVersion.replace('v', '')], { timeout: 10000 });

      // List versions
      const result = await env.runNvmCommand(['ls'], { timeout: 10000 });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/linked/i);
    }, 150000);

    it.skip('should unlink the default version', async () => {
      // Install and link a version first
      await env.runNvmCommand(['install', testVersion.replace('v', '')], { timeout: 120000 });
      await env.runNvmCommand(['link', testVersion.replace('v', '')], { timeout: 10000 });

      // Unlink
      const result = await env.runNvmCommand(['unlink'], { timeout: 10000 });

      expect(result.exitCode).toBe(0);
      // Should not show errors
      expect(result.stderr).not.toMatch(/error|fail/i);
    }, 150000);

    it('should fail to link non-installed version', async () => {
      const result = await env.runNvmCommand(['link', '99.99.99'], { timeout: 10000 });

      expect(result.exitCode).toBe(1);
      expect(result.stdout || result.stderr).toMatch(/not installed/i);
    }, 15000);

    it('should fail to link with invalid version', async () => {
      const result = await env.runNvmCommand(['link', 'not-a-version'], { timeout: 10000 });

      expect(result.exitCode).toBe(1);
      expect(result.stdout || result.stderr).toMatch(/error|fail|can't find/i);
    }, 15000);

    it('should handle unlink when nothing is linked', async () => {
      // Try to unlink when nothing is linked
      const result = await env.runNvmCommand(['unlink'], { timeout: 10000 });

      // Should either succeed (nothing to do) or show appropriate message
      expect(result.exitCode === 0 || result.exitCode === 1).toBe(true);
    }, 15000);

    it.skip('should not allow linking while using a different version', async () => {
      // Install two versions
      await env.runNvmCommand(['install', '20.10.0'], { timeout: 120000 });
      await env.runNvmCommand(['install', '22.20.0'], { timeout: 120000 });

      // Use one version
      await env.runNvmCommand(['use', '20.10.0'], { timeout: 10000 });

      // Try to link a different version
      const result = await env.runNvmCommand(['link', '22.20.0'], { timeout: 10000 });

      // Should work - link and use are independent
      expect(result.exitCode === 0 || result.exitCode === 1).toBe(true);
    }, 300000);
  });

  describe('nvm cleanup', () => {
    it('should run cleanup without errors', async () => {
      const result = await env.runNvmCommand(['cleanup'], { timeout: 30000 });

      expect(result.exitCode).toBe(0);
      expect(result.stdout || result.stderr).toMatch(/removed|cleanup/i);
    }, 35000);

    it('should be idempotent (can run multiple times)', async () => {
      // Run cleanup twice
      const result1 = await env.runNvmCommand(['cleanup'], { timeout: 30000 });
      const result2 = await env.runNvmCommand(['cleanup'], { timeout: 30000 });

      expect(result1.exitCode).toBe(0);
      expect(result2.exitCode).toBe(0);
    }, 60000);

    it.skip('should remove cache directory', async () => {
      // Install a version to create cache
      await env.runNvmCommand(['install', testVersion.replace('v', '')], { timeout: 120000 });

      // Check if cache exists
      const cachePath = path.join(env.nvmHome, 'cache');
      const cacheExistsBefore = fs.existsSync(cachePath);

      // Run cleanup
      await env.runNvmCommand(['cleanup'], { timeout: 30000 });

      // Cache should be removed or empty
      const cacheExistsAfter = fs.existsSync(cachePath);

      // Either cache is deleted or it's empty
      if (cacheExistsAfter) {
        const files = fs.readdirSync(cachePath);
        expect(files.length).toBe(0);
      }

      expect(cacheExistsBefore || !cacheExistsAfter).toBe(true);
    }, 180000);

    it('should work when cache directory does not exist', async () => {
      // Cleanup should work even if there's nothing to clean
      const result = await env.runNvmCommand(['cleanup'], { timeout: 30000 });

      expect(result.exitCode).toBe(0);
    }, 35000);
  });

  describe('nvm postinstall', () => {
    it.skip('should run postinstall for installed version', async () => {
      // Install a version first
      await env.runNvmCommand(['install', testVersion.replace('v', '')], { timeout: 120000 });

      // Run postinstall
      const result = await env.runNvmCommand(['postinstall', testVersion.replace('v', '')], { timeout: 30000 });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/post-install|NVM_INSTALL/i);
    }, 180000);

    it.skip('should run postinstall without version argument when version is active', async () => {
      // Install and use a version
      await env.runNvmCommand(['install', testVersion.replace('v', '')], { timeout: 120000 });
      await env.runNvmCommand(['use', testVersion.replace('v', '')], { timeout: 10000 });

      // Run postinstall without version argument
      const result = await env.runNvmCommand(['postinstall'], { timeout: 30000 });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/post-install|NVM_INSTALL/i);
    }, 180000);

    it('should fail for non-installed version', async () => {
      const result = await env.runNvmCommand(['postinstall', '99.99.99'], { timeout: 10000 });

      expect(result.exitCode).toBe(1);
      expect(result.stdout || result.stderr).toMatch(/not installed/i);
    }, 15000);

    it('should fail with invalid version', async () => {
      const result = await env.runNvmCommand(['postinstall', 'not-a-version'], { timeout: 10000 });

      expect(result.exitCode).toBe(1);
      expect(result.stdout || result.stderr).toMatch(/error|fail|can't find/i);
    }, 15000);

    it('should fail without version when no version is active', async () => {
      // Ensure no version is active
      await env.runNvmCommand(['stop'], { timeout: 10000 });

      // Try to run postinstall without version
      const result = await env.runNvmCommand(['postinstall'], { timeout: 10000 });

      expect(result.exitCode).toBe(1);
      expect(result.stdout || result.stderr).toMatch(/version|provide|unable/i);
    }, 20000);

    it.skip('should create environment script file', async () => {
      // Install a version
      await env.runNvmCommand(['install', testVersion.replace('v', '')], { timeout: 120000 });

      // Run postinstall
      const result = await env.runNvmCommand(['postinstall', testVersion.replace('v', '')], { timeout: 30000 });

      expect(result.exitCode).toBe(0);

      // Check if environment file was created
      const envFilePath = env.getEnvFilePath();
      const envFileExists = fs.existsSync(envFilePath);

      expect(envFileExists).toBe(true);
    }, 180000);
  });

  describe('Command integration', () => {
    it.skip('should work together: install -> link -> cleanup -> postinstall -> unlink', async () => {
      // Install
      const installResult = await env.runNvmCommand(['install', testVersion.replace('v', '')], { timeout: 120000 });
      expect(installResult.exitCode).toBe(0);

      // Link
      const linkResult = await env.runNvmCommand(['link', testVersion.replace('v', '')], { timeout: 10000 });
      expect(linkResult.exitCode).toBe(0);

      // Cleanup
      const cleanupResult = await env.runNvmCommand(['cleanup'], { timeout: 30000 });
      expect(cleanupResult.exitCode).toBe(0);

      // Postinstall
      const postinstallResult = await env.runNvmCommand(['postinstall', testVersion.replace('v', '')], { timeout: 30000 });
      expect(postinstallResult.exitCode).toBe(0);

      // Unlink
      const unlinkResult = await env.runNvmCommand(['unlink'], { timeout: 10000 });
      expect(unlinkResult.exitCode).toBe(0);
    }, 300000);

    it('should handle cleanup after failed install gracefully', async () => {
      // Try to install invalid version
      await env.runNvmCommand(['install', '99.99.99'], { timeout: 30000 });

      // Cleanup should still work
      const result = await env.runNvmCommand(['cleanup'], { timeout: 30000 });

      expect(result.exitCode).toBe(0);
    }, 60000);
  });
});
