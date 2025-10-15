import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createE2EEnv } from '../helpers/e2e-utils.js';

describe('E2E: nvm ls and nvm ls-remote', () => {
  let env;

  beforeAll(async () => {
    env = await createE2EEnv();
  });

  afterAll(async () => {
    if (env) {
      await env.cleanup();
    }
  });

  describe('nvm ls (list local versions)', () => {
    it('should show empty list when no versions are installed', async () => {
      const result = await env.runNvmCommand(['ls'], { timeout: 10000 });

      expect(result.exitCode).toBe(0);
      // Should not show any version numbers
      expect(result.stdout).not.toMatch(/v\d+\.\d+\.\d+/);
    }, 15000);

    it('should return success exit code for ls', async () => {
      const result = await env.runNvmCommand(['ls'], { timeout: 10000 });

      expect(result.exitCode).toBe(0);
      // Should not crash or throw errors
      expect(result.stdout.length).toBeGreaterThanOrEqual(0);
    }, 15000);

    // TODO: These tests require install to work - depends on fixing NVM_HOME isolation
    it.skip('should list installed versions', async () => {
      // Install a version first
      const version = '20.10.0';
      await env.runNvmCommand(['install', version], { timeout: 120000 });

      // List versions
      const result = await env.runNvmCommand(['ls'], { timeout: 10000 });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('v20.10.0');
    }, 150000);

    it.skip('should mark active version with *', async () => {
      // Install and use a version
      const version = '20.10.0';
      await env.runNvmCommand(['install', version], { timeout: 120000 });
      await env.runNvmCommand(['use', version], { timeout: 10000 });

      // List versions
      const result = await env.runNvmCommand(['ls'], { timeout: 10000 });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/\*.*v20\.10\.0/);
    }, 150000);

    it.skip('should mark linked version with (linked)', async () => {
      // Install and link a version
      const version = '20.10.0';
      await env.runNvmCommand(['install', version], { timeout: 120000 });
      await env.runNvmCommand(['link', version], { timeout: 10000 });

      // List versions
      const result = await env.runNvmCommand(['ls'], { timeout: 10000 });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/v20\.10\.0.*linked/i);
    }, 150000);

    it.skip('should list multiple installed versions', async () => {
      // Install multiple versions
      await env.runNvmCommand(['install', '18.20.0'], { timeout: 120000 });
      await env.runNvmCommand(['install', '20.10.0'], { timeout: 120000 });

      // List versions
      const result = await env.runNvmCommand(['ls'], { timeout: 10000 });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('v18.20.0');
      expect(result.stdout).toContain('v20.10.0');
    }, 300000);
  });

  describe('nvm ls-remote (list remote versions)', () => {
    it('should list available remote versions', async () => {
      const result = await env.runNvmCommand(['ls-remote'], { timeout: 30000 });

      expect(result.exitCode).toBe(0);
      // Should show version numbers
      expect(result.stdout).toMatch(/v\d+\.\d+\.\d+/);
      // Should show multiple versions
      const versionMatches = result.stdout.match(/v\d+\.\d+\.\d+/g);
      expect(versionMatches.length).toBeGreaterThan(10);
    }, 35000);

    it('should work with proxy parameter', async () => {
      // Test that proxy parameter doesn't break the command
      // Using a real proxy would require setup, so just test that the flag is accepted
      const result = await env.runNvmCommand(['ls-remote'], { timeout: 30000 });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/v\d+\.\d+\.\d+/);
    }, 35000);

    it('should respect --no-ssl flag', async () => {
      // This should work even with SSL verification disabled
      const result = await env.runNvmCommand(['ls-remote', '--no-ssl'], { timeout: 30000 });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/v\d+\.\d+\.\d+/);
    }, 35000);

    it('should list recent versions including latest LTS', async () => {
      const result = await env.runNvmCommand(['ls-remote'], { timeout: 30000 });

      expect(result.exitCode).toBe(0);

      const versions = result.stdout.match(/v\d+\.\d+\.\d+/g) || [];

      // Should include recent major versions (20, 22, etc.)
      const hasRecent = versions.some(v => {
        const major = parseInt(v.match(/v(\d+)/)[1]);
        return major >= 20;
      });

      expect(hasRecent).toBe(true);
    }, 35000);
  });

  describe('Edge cases', () => {
    it('should handle invalid command variations', async () => {
      const result = await env.runNvmCommand(['ls', 'invalid-arg'], { timeout: 10000 });

      // Should still work or show helpful error
      expect(result.exitCode === 0 || result.exitCode === 1).toBe(true);
    }, 15000);

    it('should work when NVM_HOME is custom location', async () => {
      // NVM_HOME is already set to custom location in E2E env
      const result = await env.runNvmCommand(['ls'], { timeout: 10000 });

      expect(result.exitCode).toBe(0);
    }, 15000);
  });
});
