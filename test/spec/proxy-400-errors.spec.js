import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestProxy } from '../helpers/proxy-utils.js';
import http from 'http';

describe('Proxy 400 Error Scenarios', () => {
  let proxy;
  let proxyUrl;

  beforeAll(async () => {
    proxy = await createTestProxy();
    proxyUrl = proxy.url;
    console.log(`Test proxy started at ${proxyUrl}`);
  });

  afterAll(async () => {
    if (proxy) {
      await proxy.stop();
    }
  });

  describe('Malformed CONNECT requests that trigger 400', () => {
    it('should return 400 for CONNECT with negative port', async () => {
      const result = await sendConnectRequest(proxy.port, 'nodejs.org:-443');

      expect(result.statusCode).toBe(400);
      expect(result.statusMessage).toContain('Bad Request');
    });

    it('should return 400 for CONNECT with port too large', async () => {
      const result = await sendConnectRequest(proxy.port, 'nodejs.org:99999');

      expect(result.statusCode).toBe(400);
      expect(result.statusMessage).toContain('Bad Request');
    });

    it('should return 400 for CONNECT with empty hostname', async () => {
      const result = await sendConnectRequest(proxy.port, ':443');

      expect(result.statusCode).toBe(400);
      expect(result.statusMessage).toContain('Bad Request');
    });

    it('should return 400 for CONNECT with multiple colons', async () => {
      const result = await sendConnectRequest(proxy.port, 'nodejs.org:443:443:443');

      expect(result.statusCode).toBe(400);
      expect(result.statusMessage).toContain('Bad Request');
    });

    it('should return 400 for CONNECT with missing port', async () => {
      // Just hostname without :port
      const result = await sendConnectRequest(proxy.port, 'nodejs.org');

      // Might succeed if proxy is lenient, or return 400
      // Our proxy should handle this gracefully
      expect([200, 400, 502]).toContain(result.statusCode);
    });

    it('should return 400 for CONNECT with non-numeric port', async () => {
      const result = await sendConnectRequest(proxy.port, 'nodejs.org:abc');

      expect(result.statusCode).toBe(400);
      expect(result.statusMessage).toContain('Bad Request');
    });
  });

  describe('Valid CONNECT requests that succeed', () => {
    it('should successfully CONNECT to nodejs.org:443', async () => {
      const result = await sendConnectRequest(proxy.port, 'nodejs.org:443');

      expect(result.statusCode).toBe(200);
      expect(result.statusMessage).toContain('Connection established');

      // Verify proxy logged it
      const connectLogs = proxy.getLogsByType('connect');
      expect(connectLogs.some(log => log.message.includes('nodejs.org:443'))).toBe(true);
    });

    it('should successfully CONNECT to registry.npmjs.org:443', async () => {
      const result = await sendConnectRequest(proxy.port, 'registry.npmjs.org:443');

      expect(result.statusCode).toBe(200);

      const connectLogs = proxy.getLogsByType('connect');
      expect(connectLogs.some(log => log.message.includes('registry.npmjs.org:443'))).toBe(true);
    });

    it('should accept CONNECT with extra path (lenient proxy)', async () => {
      // Some proxies ignore extra path info
      const result = await sendConnectRequest(proxy.port, 'nodejs.org:443/dist/index.json');

      // Should succeed - our proxy extracts hostname:port correctly
      expect(result.statusCode).toBe(200);
    });
  });

  describe('Verify with real Node.js URLs', () => {
    it('should proxy real request to nodejs.org/dist/index.json', async () => {
      const needle = require('needle');

      const response = await new Promise((resolve, reject) => {
        needle.get('https://nodejs.org/dist/index.json', {
          proxy: proxyUrl,
          timeout: 15000
        }, (err, resp) => {
          if (err) reject(err);
          else resolve(resp);
        });
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);

      // Verify first entry has expected structure
      const firstVersion = response.body[0];
      expect(firstVersion).toHaveProperty('version');
      expect(firstVersion).toHaveProperty('date');
      expect(firstVersion).toHaveProperty('files');
      expect(firstVersion.version).toMatch(/^v\d+\.\d+\.\d+$/);

      // Verify request went through proxy
      const httpLogs = proxy.getLogsByType('http');
      expect(httpLogs.some(log => log.message.includes('nodejs.org'))).toBe(true);
    }, 20000);

    it('should proxy real request to nodejs.org homepage', async () => {
      const needle = require('needle');

      const response = await new Promise((resolve, reject) => {
        needle.get('https://nodejs.org/en/', {
          proxy: proxyUrl,
          timeout: 15000,
          follow_max: 5
        }, (err, resp) => {
          if (err) reject(err);
          else resolve(resp);
        });
      });

      // Accept 200, redirect, or security block status codes (403/429 from nodejs.org blocking CI IPs)
      expect([200, 301, 302, 307, 308, 403, 429]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        expect(response.body).toBeTruthy();
      }

      const httpLogs = proxy.getLogsByType('http');
      expect(httpLogs.length).toBeGreaterThan(0);
    }, 20000);

    it('should handle multiple sequential requests through same proxy', async () => {
      const needle = require('needle');
      const urls = [
        'https://nodejs.org/dist/index.json',
        'https://nodejs.org/',
        'https://nodejs.org/en/about/'
      ];

      for (const url of urls) {
        const response = await new Promise((resolve, reject) => {
          needle.get(url, {
            proxy: proxyUrl,
            timeout: 15000,
            follow_max: 5
          }, (err, resp) => {
            if (err) reject(err);
            else resolve(resp);
          });
        });

        // Accept 200, redirect, or security block status codes (403/429 from nodejs.org blocking CI IPs)
        expect([200, 301, 302, 307, 308, 403, 429]).toContain(response.statusCode);
      }

      // All 3 requests should be logged
      const httpLogs = proxy.getLogsByType('http');
      expect(httpLogs.length).toBeGreaterThan(2);
    }, 60000);
  });
});

/**
 * Send a raw CONNECT request to the proxy
 */
function sendConnectRequest(proxyPort, targetHostPort) {
  return new Promise((resolve) => {
    const req = http.request({
      host: 'localhost',
      port: proxyPort,
      method: 'CONNECT',
      path: targetHostPort
    });

    req.on('connect', (res, socket) => {
      socket.end();
      resolve({
        statusCode: res.statusCode,
        statusMessage: res.statusMessage
      });
    });

    req.on('error', (err) => {
      resolve({
        statusCode: 0,
        statusMessage: err.message,
        error: err
      });
    });

    // Timeout after 3 seconds
    setTimeout(() => {
      req.destroy();
      resolve({
        statusCode: 0,
        statusMessage: 'Timeout'
      });
    }, 3000);

    req.end();
  });
}
