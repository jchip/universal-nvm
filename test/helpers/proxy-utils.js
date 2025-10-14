/**
 * Utility functions for proxy testing
 */

const TestProxyServer = require('./test-proxy-server');

/**
 * Create and start a test proxy server
 */
async function createTestProxy(options = {}) {
  const proxy = new TestProxyServer(options);
  await proxy.start();
  return proxy;
}

/**
 * Create a proxy that simulates errors
 */
async function createErrorProxy(errorCode = 400) {
  const proxy = new TestProxyServer({
    simulateErrors: true,
    errorCode
  });
  await proxy.start();
  return proxy;
}

/**
 * Wait for a condition with timeout
 */
async function waitFor(condition, timeout = 5000, interval = 100) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Make a request through a proxy
 */
async function makeProxyRequest(proxyUrl, targetUrl, options = {}) {
  const needle = require('needle');

  return new Promise((resolve, reject) => {
    const requestOptions = {
      proxy: proxyUrl,
      rejectUnauthorized: options.verifyssl !== false,
      timeout: options.timeout || 5000,
      ...options
    };

    needle.get(targetUrl, requestOptions, (err, response) => {
      if (err) {
        reject(err);
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Test if a proxy is accessible
 */
async function isProxyAccessible(proxyUrl, targetUrl = 'https://nodejs.org/dist/index.json') {
  try {
    const response = await makeProxyRequest(proxyUrl, targetUrl, { timeout: 3000 });
    return response.statusCode >= 200 && response.statusCode < 400;
  } catch (err) {
    return false;
  }
}

/**
 * Get proxy logs that match a pattern
 */
function getMatchingLogs(proxy, pattern) {
  return proxy.getLogs().filter(log =>
    log.message.match(pattern) || log.type.match(pattern)
  );
}

/**
 * Assert proxy logged a specific event
 */
function assertProxyLogged(proxy, type, messagePattern) {
  const logs = proxy.getLogsByType(type);
  const matched = logs.some(log => log.message.match(messagePattern));

  if (!matched) {
    const allMessages = logs.map(l => l.message).join('\n');
    throw new Error(
      `Expected proxy to log type="${type}" matching "${messagePattern}"\n` +
      `Actual logs:\n${allMessages}`
    );
  }
}

module.exports = {
  createTestProxy,
  createErrorProxy,
  waitFor,
  makeProxyRequest,
  isProxyAccessible,
  getMatchingLogs,
  assertProxyLogged,
  TestProxyServer
};
