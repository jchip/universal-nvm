import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { spawn } from 'child_process';
import { createTestProxy, createErrorProxy, makeProxyRequest, assertProxyLogged } from '../helpers/proxy-utils.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const common = require("../../lib/common");

describe('Proxy Integration Tests', () => {
  let proxy;
  let proxyUrl;

  beforeAll(async () => {
    // Create a test proxy server
    proxy = await createTestProxy();
    proxyUrl = proxy.url;
    console.log(`Test proxy started at ${proxyUrl}`);
  });

  afterAll(async () => {
    if (proxy) {
      await proxy.stop();
    }
  });

  beforeEach(() => {
    // Clear logs before each test
    proxy.clearLogs();

    // Clear remote versions cache before each test to ensure HTTP requests are made
    const nvmHome = process.env.NVM_HOME || path.join(os.homedir(), '.unvm');
    const cachePath = path.join(nvmHome, 'cache', 'remote-versions.json');
    try {
      if (fs.existsSync(cachePath)) {
        fs.unlinkSync(cachePath);
      }
    } catch (err) {
      // Ignore errors if cache doesn't exist
    }
  });

  describe('Test Proxy Server', () => {
    it('should start successfully', () => {
      expect(proxy.port).toBeGreaterThan(0);
      expect(proxyUrl).toMatch(/^http:\/\/localhost:\d+$/);
    });

    it('should handle HTTPS requests through proxy', async () => {
      const response = await makeProxyRequest(
        proxyUrl,
        'https://nodejs.org/dist/index.json',
        { timeout: 10000 }
      );

      expect(response.statusCode).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);

      // Verify proxy logged the request (needle uses HTTP GET with full URL, not CONNECT)
      const httpLogs = proxy.getLogsByType('http');
      expect(httpLogs.length).toBeGreaterThan(0);

      const successLogs = proxy.getLogsByType('success');
      expect(successLogs.length).toBeGreaterThan(0);
    }, 15000);

    it('should log all proxy activity', async () => {
      await makeProxyRequest(
        proxyUrl,
        'https://nodejs.org/dist/index.json',
        { timeout: 10000 }
      );

      const logs = proxy.getLogs();
      expect(logs.length).toBeGreaterThan(0);

      const httpLogs = proxy.getLogsByType('http');
      expect(httpLogs.length).toBeGreaterThan(0);
    }, 15000);
  });

  describe('common.getRemoteFromJson with proxy', () => {
    it('should fetch versions through test proxy', async () => {
      const versions = await common.getRemoteFromJson(proxyUrl, true, undefined, false);

      expect(versions).toBeInstanceOf(Array);
      expect(versions.length).toBeGreaterThan(0);

      // Verify the request went through our proxy
      const httpLogs = proxy.getLogsByType('http');
      expect(httpLogs.length).toBeGreaterThan(0);

      const successLogs = proxy.getLogsByType('success');
      expect(successLogs.length).toBeGreaterThan(0);
    }, 30000);

    it('should respect verifyssl parameter', async () => {
      // With SSL verification
      const versionsWithSSL = await common.getRemoteFromJson(proxyUrl, true, undefined, false);
      expect(versionsWithSSL).toBeInstanceOf(Array);

      // Without SSL verification (should still work with our test proxy)
      const versionsNoSSL = await common.getRemoteFromJson(proxyUrl, false, undefined, false);
      expect(versionsNoSSL).toBeInstanceOf(Array);
    }, 30000);
  });

  describe('Error handling', () => {
    let errorProxy;
    let errorProxyUrl;

    beforeAll(async () => {
      // Create a proxy that simulates 400 errors
      errorProxy = await createErrorProxy(400);
      errorProxyUrl = errorProxy.url;
    });

    afterAll(async () => {
      if (errorProxy) {
        await errorProxy.stop();
      }
    });

    it('should handle proxy returning 400 error', async () => {
      const response = await makeProxyRequest(
        errorProxyUrl,
        'https://nodejs.org/dist/index.json',
        { timeout: 5000 }
      );

      // The request succeeds but returns 400 status
      expect(response.statusCode).toBe(400);
    }, 10000);

    it('should fail gracefully when proxy is unreachable', async () => {
      const badProxyUrl = 'http://localhost:9999';

      await expect(
        makeProxyRequest(badProxyUrl, 'https://nodejs.org/dist/index.json', { timeout: 3000 })
      ).rejects.toThrow();
    }, 10000);
  });

  describe('nvm CLI with test proxy', () => {
    it('should use proxy from -p flag', async () => {
      const result = await runNvmCommand(['ls-remote', '-p', proxyUrl]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/v\d+\.\d+\.\d+/);

      // Verify request went through our proxy
      const httpLogs = proxy.getLogsByType('http');
      expect(httpLogs.length).toBeGreaterThan(0);
    }, 30000);

    it('should use proxy from NVM_PROXY env var', async () => {
      const result = await runNvmCommand(['ls-remote'], {
        env: { ...process.env, NVM_PROXY: proxyUrl }
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/v\d+\.\d+\.\d+/);

      const httpLogs = proxy.getLogsByType('http');
      expect(httpLogs.length).toBeGreaterThan(0);
    }, 30000);

    it('should use proxy from HTTPS_PROXY env var', async () => {
      const result = await runNvmCommand(['ls-remote'], {
        env: { ...process.env, HTTPS_PROXY: proxyUrl }
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/v\d+\.\d+\.\d+/);

      const httpLogs = proxy.getLogsByType('http');
      expect(httpLogs.length).toBeGreaterThan(0);
    }, 30000);

    it('should use proxy from HTTP_PROXY env var', async () => {
      // Create clean env without higher-priority proxy vars
      const cleanEnv = { ...process.env };
      delete cleanEnv.NVM_PROXY;
      delete cleanEnv.https_proxy;
      delete cleanEnv.HTTPS_PROXY;
      delete cleanEnv.http_proxy;
      cleanEnv.HTTP_PROXY = proxyUrl;

      const result = await runNvmCommand(['ls-remote'], {
        env: cleanEnv
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/v\d+\.\d+\.\d+/);

      const httpLogs = proxy.getLogsByType('http');
      expect(httpLogs.length).toBeGreaterThan(0);
    }, 30000);
  });
});

/**
 * Helper function to run nvm commands
 */
function runNvmCommand(args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn('node', ['dist/unvm.js', ...args], {
      ...options,
      env: options.env || process.env
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', data => stdout += data);
    child.stderr.on('data', data => stderr += data);

    child.on('close', (exitCode) => {
      resolve({
        exitCode,
        stdout,
        stderr
      });
    });

    child.on('error', (error) => {
      resolve({
        exitCode: 1,
        stdout,
        stderr: error.message
      });
    });

    // Timeout after 25 seconds
    setTimeout(() => {
      child.kill();
      resolve({
        exitCode: 1,
        stdout,
        stderr: 'Command timeout'
      });
    }, 25000);
  });
}
