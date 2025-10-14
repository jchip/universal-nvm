/**
 * Simple HTTP proxy server for testing
 * Supports HTTP CONNECT tunneling for HTTPS requests
 */

const http = require('http');
const net = require('net');
const { URL } = require('url');

class TestProxyServer {
  constructor(options = {}) {
    this.port = options.port || 0; // 0 = random available port
    this.host = options.host || 'localhost';
    this.server = null;
    this.connections = [];
    this.logs = [];
    this.simulateErrors = options.simulateErrors || false;
    this.errorCode = options.errorCode || 400;
  }

  /**
   * Start the proxy server
   */
  async start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        // Handle regular HTTP requests (not CONNECT)
        this._handleHttpRequest(req, res);
      });

      // Handle CONNECT requests for HTTPS tunneling
      this.server.on('connect', (req, clientSocket, head) => {
        this._handleConnect(req, clientSocket, head);
      });

      this.server.on('error', (err) => {
        reject(err);
      });

      this.server.listen(this.port, this.host, () => {
        const address = this.server.address();
        this.port = address.port;
        this.url = `http://${this.host}:${this.port}`;
        this.log('info', `Proxy server started on ${this.host}:${this.port}`);
        resolve({ host: this.host, port: this.port, url: this.url });
      });
    });
  }

  /**
   * Stop the proxy server
   */
  async stop() {
    return new Promise((resolve) => {
      // Close all active connections
      this.connections.forEach(socket => {
        socket.destroy();
      });
      this.connections = [];

      if (this.server) {
        this.server.close(() => {
          this.log('info', 'Proxy server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Handle HTTP CONNECT for HTTPS tunneling
   */
  _handleConnect(req, clientSocket, head) {
    const { port, hostname } = this._parseHostPort(req.url);

    this.log('connect', `CONNECT ${req.url}`);

    // Simulate errors if configured
    if (this.simulateErrors) {
      clientSocket.write(`HTTP/1.1 ${this.errorCode} Connection failed\r\n\r\n`);
      clientSocket.end();
      this.log('error', `Simulated error ${this.errorCode} for ${req.url}`);
      return;
    }

    // Validate the CONNECT request
    if (!hostname || !port) {
      clientSocket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      clientSocket.end();
      this.log('error', `Invalid CONNECT request: ${req.url}`);
      return;
    }

    // Create connection to the target server
    const serverSocket = net.connect(port, hostname, () => {
      clientSocket.write('HTTP/1.1 200 Connection established\r\n\r\n');
      serverSocket.write(head);
      serverSocket.pipe(clientSocket);
      clientSocket.pipe(serverSocket);

      this.log('success', `Tunnel established to ${hostname}:${port}`);
    });

    serverSocket.on('error', (err) => {
      clientSocket.end();
      this.log('error', `Failed to connect to ${hostname}:${port}: ${err.message}`);
    });

    clientSocket.on('error', (err) => {
      serverSocket.end();
      this.log('error', `Client socket error: ${err.message}`);
    });

    // Track connection
    this.connections.push(clientSocket);
    this.connections.push(serverSocket);

    const cleanup = () => {
      this.connections = this.connections.filter(s => s !== clientSocket && s !== serverSocket);
    };

    clientSocket.on('close', cleanup);
    serverSocket.on('close', cleanup);
  }

  /**
   * Handle regular HTTP requests
   */
  _handleHttpRequest(req, res) {
    this.log('http', `${req.method} ${req.url}`);

    // Simulate errors if configured
    if (this.simulateErrors) {
      res.writeHead(this.errorCode, { 'Content-Type': 'text/plain' });
      res.end(`Simulated error ${this.errorCode}`);
      return;
    }

    try {
      const url = new URL(req.url);

      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: req.method,
        headers: req.headers
      };

      const protocol = url.protocol === 'https:' ? require('https') : http;

      const proxyReq = protocol.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
        this.log('success', `Proxied ${req.method} ${req.url} -> ${proxyRes.statusCode}`);
      });

      proxyReq.on('error', (err) => {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end(`Proxy error: ${err.message}`);
        this.log('error', `Proxy request failed: ${err.message}`);
      });

      req.pipe(proxyReq);
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end(`Bad request: ${err.message}`);
      this.log('error', `Bad request: ${err.message}`);
    }
  }

  /**
   * Parse host:port from CONNECT request
   */
  _parseHostPort(hostPort) {
    const parts = hostPort.split(':');
    if (parts.length !== 2) {
      return { hostname: null, port: null };
    }

    const port = parseInt(parts[1], 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      return { hostname: null, port: null };
    }

    return { hostname: parts[0], port };
  }

  /**
   * Log proxy activity
   */
  log(type, message) {
    const entry = {
      timestamp: new Date().toISOString(),
      type,
      message
    };
    this.logs.push(entry);
  }

  /**
   * Get all logs
   */
  getLogs() {
    return this.logs;
  }

  /**
   * Clear logs
   */
  clearLogs() {
    this.logs = [];
  }

  /**
   * Get logs by type
   */
  getLogsByType(type) {
    return this.logs.filter(log => log.type === type);
  }

  /**
   * Enable error simulation
   */
  enableErrorSimulation(errorCode = 400) {
    this.simulateErrors = true;
    this.errorCode = errorCode;
  }

  /**
   * Disable error simulation
   */
  disableErrorSimulation() {
    this.simulateErrors = false;
  }
}

module.exports = TestProxyServer;
