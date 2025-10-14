import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createE2EEnv } from '../helpers/e2e-utils.js';
import { createTestProxy } from '../helpers/proxy-utils.js';

describe('E2E: Proxy Support', () => {
  let env;
  let proxy;

  beforeAll(async () => {
    env = await createE2EEnv();
    proxy = await createTestProxy();
    console.log(`Test proxy started at ${proxy.url}`);
  });

  afterAll(async () => {
    if (proxy) {
      await proxy.stop();
    }
    if (env) {
      await env.cleanup();
    }
  });

  describe('NVM_PROXY environment variable', () => {
    it('should use NVM_PROXY for ls-remote', async () => {
      proxy.clearLogs();

      const result = await env.runNvmCommand(['ls-remote'], {
        env: { NVM_PROXY: proxy.url },
        timeout: 30000
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/v\d+\.\d+\.\d+/);

      // Verify request went through proxy
      const httpLogs = proxy.getLogsByType('http');
      expect(httpLogs.length).toBeGreaterThan(0);
      expect(httpLogs.some(log => log.message.includes('nodejs.org'))).toBe(true);
    }, 35000);

    // TODO: Fix install tests - NVM_HOME environment variable not properly isolated in CI
    it.skip('should use NVM_PROXY for install', async () => {
      proxy.clearLogs();

      // Use a specific older version that's unlikely to be installed
      const testVersion = '18.19.0';
      const result = await env.runNvmCommand(['install', testVersion], {
        env: { NVM_PROXY: proxy.url },
        timeout: 120000
      });

      // Accept success or already installed
      const isAlreadyInstalled = result.stdout.includes('already installed');
      expect(result.exitCode === 0 || isAlreadyInstalled).toBe(true);

      // Verify request went through proxy
      const httpLogs = proxy.getLogsByType('http');
      expect(httpLogs.length).toBeGreaterThan(0);
      expect(httpLogs.some(log => log.message.includes('nodejs.org'))).toBe(true);
    }, 150000);
  });

  describe('HTTPS_PROXY environment variable', () => {
    it('should use HTTPS_PROXY for ls-remote', async () => {
      proxy.clearLogs();

      const result = await env.runNvmCommand(['ls-remote'], {
        env: { HTTPS_PROXY: proxy.url },
        timeout: 30000
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/v\d+\.\d+\.\d+/);

      // Verify request went through proxy
      const httpLogs = proxy.getLogsByType('http');
      expect(httpLogs.length).toBeGreaterThan(0);
    }, 35000);
  });

  describe('HTTP_PROXY environment variable', () => {
    it('should use HTTP_PROXY for ls-remote', async () => {
      proxy.clearLogs();

      const result = await env.runNvmCommand(['ls-remote'], {
        env: { HTTP_PROXY: proxy.url },
        timeout: 30000
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/v\d+\.\d+\.\d+/);

      // Verify request went through proxy
      const httpLogs = proxy.getLogsByType('http');
      expect(httpLogs.length).toBeGreaterThan(0);
    }, 35000);
  });

  describe('Proxy priority', () => {
    it('should prefer -p flag over NVM_PROXY', async () => {
      proxy.clearLogs();

      const result = await env.runNvmCommand(['ls-remote', '-p', proxy.url], {
        env: { NVM_PROXY: 'http://invalid-proxy:9999' },
        timeout: 30000
      });

      expect(result.exitCode).toBe(0);

      // Verify request went through our test proxy (not the invalid one)
      const httpLogs = proxy.getLogsByType('http');
      expect(httpLogs.length).toBeGreaterThan(0);
    }, 35000);

    it('should prefer NVM_PROXY over HTTPS_PROXY', async () => {
      proxy.clearLogs();

      const result = await env.runNvmCommand(['ls-remote'], {
        env: {
          NVM_PROXY: proxy.url,
          HTTPS_PROXY: 'http://invalid-proxy:9999'
        },
        timeout: 30000
      });

      expect(result.exitCode).toBe(0);

      // Verify request went through our test proxy (not the invalid one)
      const httpLogs = proxy.getLogsByType('http');
      expect(httpLogs.length).toBeGreaterThan(0);
    }, 35000);

    it('should prefer HTTPS_PROXY over HTTP_PROXY', async () => {
      proxy.clearLogs();

      const result = await env.runNvmCommand(['ls-remote'], {
        env: {
          HTTPS_PROXY: proxy.url,
          HTTP_PROXY: 'http://invalid-proxy:9999'
        },
        timeout: 30000
      });

      expect(result.exitCode).toBe(0);

      // Verify request went through our test proxy (not the invalid one)
      const httpLogs = proxy.getLogsByType('http');
      expect(httpLogs.length).toBeGreaterThan(0);
    }, 35000);
  });
});
