/**
 * E2E test utilities for testing real installation and usage
 */

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const rimraf = require('rimraf');

const isWindows = process.platform === 'win32';

class E2ETestEnv {
  constructor(options = {}) {
    this.testId = `nvm-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    this.nvmHome = options.nvmHome || path.join(os.tmpdir(), this.testId);
    this.nvmLink = path.join(this.nvmHome, 'nodejs', 'bin');
    this.projectRoot = path.resolve(__dirname, '../..');
    this.installScriptPath = isWindows
      ? path.join(this.projectRoot, 'install.ps1')
      : path.join(this.projectRoot, 'install.sh');
    this.distPath = path.join(this.projectRoot, 'dist', 'nvm.js');
    this.binPath = path.join(this.projectRoot, 'bin');
  }

  /**
   * Set up the test environment by copying necessary files
   */
  async setup() {
    // Create NVM_HOME directory
    if (!fs.existsSync(this.nvmHome)) {
      fs.mkdirSync(this.nvmHome, { recursive: true });
    }

    // Copy dist and bin directories to test location
    const testDist = path.join(this.nvmHome, 'dist');
    const testBin = path.join(this.nvmHome, 'bin');

    fs.mkdirSync(testDist, { recursive: true });
    fs.mkdirSync(testBin, { recursive: true });

    // Copy dist/nvm.js
    fs.copyFileSync(this.distPath, path.join(testDist, 'nvm.js'));

    // Copy bin directory files
    this._copyDirRecursive(this.binPath, testBin);

    // Copy package.json (required by dist/nvm.js)
    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    fs.copyFileSync(packageJsonPath, path.join(this.nvmHome, 'package.json'));

    console.log(`E2E test env created at ${this.nvmHome}`);
  }

  /**
   * Clean up the test environment
   */
  async cleanup() {
    if (fs.existsSync(this.nvmHome)) {
      await new Promise((resolve, reject) => {
        rimraf(this.nvmHome, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      console.log(`E2E test env cleaned up: ${this.nvmHome}`);
    }
  }

  /**
   * Run nvm command in a shell with proper environment
   */
  async runNvmCommand(args, options = {}) {
    const env = {
      ...process.env,
      NVM_HOME: this.nvmHome,
      NVM_LINK: this.nvmLink,
      ...options.env
    };

    if (isWindows) {
      return this._runNvmWindows(args, { ...options, env });
    } else {
      return this._runNvmUnix(args, { ...options, env });
    }
  }

  /**
   * Run nvm command on Windows
   */
  async _runNvmWindows(args, options) {
    const nvmScript = path.join(this.nvmHome, 'dist', 'nvm.js');

    return new Promise((resolve) => {
      const child = spawn('node', [nvmScript, ...args], {
        cwd: options.cwd || this.nvmHome,
        env: options.env,
        shell: true
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (exitCode) => {
        resolve({
          exitCode,
          stdout,
          stderr,
          success: exitCode === 0
        });
      });

      child.on('error', (error) => {
        resolve({
          exitCode: 1,
          stdout,
          stderr: error.message,
          error,
          success: false
        });
      });

      // Timeout after specified time (default 60s)
      const timeout = options.timeout || 60000;
      setTimeout(() => {
        child.kill();
        resolve({
          exitCode: 1,
          stdout,
          stderr: 'Command timeout',
          success: false
        });
      }, timeout);
    });
  }

  /**
   * Run nvm command on Unix (bash)
   */
  async _runNvmUnix(args, options) {
    const nvmScript = path.join(this.nvmHome, 'dist', 'nvm.js');
    const setupScript = path.join(this.nvmHome, 'bin', 'nvm-setup.sh');

    // Build bash command that sources setup and runs nvm
    const command = `node ${nvmScript} ${args.join(' ')}`;

    return new Promise((resolve) => {
      const child = spawn('bash', ['-c', command], {
        cwd: options.cwd || this.nvmHome,
        env: options.env
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (exitCode) => {
        resolve({
          exitCode,
          stdout,
          stderr,
          success: exitCode === 0
        });
      });

      child.on('error', (error) => {
        resolve({
          exitCode: 1,
          stdout,
          stderr: error.message,
          error,
          success: false
        });
      });

      // Timeout after specified time (default 60s)
      const timeout = options.timeout || 60000;
      setTimeout(() => {
        child.kill();
        resolve({
          exitCode: 1,
          stdout,
          stderr: 'Command timeout',
          success: false
        });
      }, timeout);
    });
  }

  /**
   * Helper to copy directory recursively
   */
  _copyDirRecursive(src, dest) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        this._copyDirRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  /**
   * Check if a Node.js version is installed
   */
  isVersionInstalled(version) {
    const versionDir = path.join(this.nvmHome, version);
    return fs.existsSync(versionDir);
  }

  /**
   * Get installed versions
   */
  getInstalledVersions() {
    if (!fs.existsSync(this.nvmHome)) {
      return [];
    }

    return fs.readdirSync(this.nvmHome)
      .filter(name => name.startsWith('v') && fs.statSync(path.join(this.nvmHome, name)).isDirectory())
      .sort();
  }

  /**
   * Get the linked version
   */
  getLinkedVersion() {
    const linkPath = path.join(this.nvmHome, 'nodejs');

    if (!fs.existsSync(linkPath)) {
      return null;
    }

    try {
      // Read symlink or junction
      const target = fs.readlinkSync(linkPath);
      return path.basename(target);
    } catch (err) {
      return null;
    }
  }
}

/**
 * Create an E2E test environment
 */
async function createE2EEnv(options = {}) {
  const env = new E2ETestEnv(options);
  await env.setup();
  return env;
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

module.exports = {
  E2ETestEnv,
  createE2EEnv,
  waitFor,
  isWindows
};
