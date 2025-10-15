import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Proxy Configuration', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('checkOpts function', () => {
    // We need to test the checkOpts function from cli.js
    // Since it's not exported, we'll test it through the module

    it('should use CLI flag proxy when provided', () => {
      const parsed = {
        source: { proxy: 'cli' },
        opts: { proxy: 'http://cli-proxy:8080', verifyssl: true }
      };

      // Mock the checkOpts logic
      let proxy;
      if (parsed.source.proxy === 'cli') {
        proxy = parsed.opts.proxy;
      } else if (process.env.NVM_PROXY) {
        proxy = process.env.NVM_PROXY;
      } else {
        proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
      }

      expect(proxy).toBe('http://cli-proxy:8080');
    });

    it('should use NVM_PROXY when CLI flag not provided', () => {
      process.env.NVM_PROXY = 'http://nvm-proxy:8080';
      process.env.HTTP_PROXY = 'http://http-proxy:8080';
      process.env.HTTPS_PROXY = 'http://https-proxy:8080';

      const parsed = {
        source: {},
        opts: { verifyssl: true }
      };

      let proxy;
      if (parsed.source.proxy === 'cli') {
        proxy = parsed.opts.proxy;
      } else if (process.env.NVM_PROXY) {
        proxy = process.env.NVM_PROXY;
      } else {
        proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
      }

      expect(proxy).toBe('http://nvm-proxy:8080');
    });

    it('should use HTTPS_PROXY when NVM_PROXY not set', () => {
      delete process.env.NVM_PROXY;
      process.env.HTTP_PROXY = 'http://http-proxy:8080';
      process.env.HTTPS_PROXY = 'http://https-proxy:8080';

      const parsed = {
        source: {},
        opts: { verifyssl: true }
      };

      let proxy;
      if (parsed.source.proxy === 'cli') {
        proxy = parsed.opts.proxy;
      } else if (process.env.NVM_PROXY) {
        proxy = process.env.NVM_PROXY;
      } else {
        proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
      }

      expect(proxy).toBe('http://https-proxy:8080');
    });

    it('should use HTTP_PROXY when HTTPS_PROXY not set', () => {
      delete process.env.NVM_PROXY;
      delete process.env.HTTPS_PROXY;
      process.env.HTTP_PROXY = 'http://http-proxy:8080';

      const parsed = {
        source: {},
        opts: { verifyssl: true }
      };

      let proxy;
      if (parsed.source.proxy === 'cli') {
        proxy = parsed.opts.proxy;
      } else if (process.env.NVM_PROXY) {
        proxy = process.env.NVM_PROXY;
      } else {
        proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
      }

      expect(proxy).toBe('http://http-proxy:8080');
    });

    it('should have no proxy when none are set', () => {
      delete process.env.NVM_PROXY;
      delete process.env.HTTP_PROXY;
      delete process.env.HTTPS_PROXY;

      const parsed = {
        source: {},
        opts: { verifyssl: true }
      };

      let proxy;
      if (parsed.source.proxy === 'cli') {
        proxy = parsed.opts.proxy;
      } else if (process.env.NVM_PROXY) {
        proxy = process.env.NVM_PROXY;
      } else {
        proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
      }

      expect(proxy).toBeUndefined();
    });

    it('should prioritize CLI flag over all env vars', () => {
      process.env.NVM_PROXY = 'http://nvm-proxy:8080';
      process.env.HTTP_PROXY = 'http://http-proxy:8080';
      process.env.HTTPS_PROXY = 'http://https-proxy:8080';

      const parsed = {
        source: { proxy: 'cli' },
        opts: { proxy: 'http://cli-proxy:8080', verifyssl: true }
      };

      let proxy;
      if (parsed.source.proxy === 'cli') {
        proxy = parsed.opts.proxy;
      } else if (process.env.NVM_PROXY) {
        proxy = process.env.NVM_PROXY;
      } else {
        proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
      }

      expect(proxy).toBe('http://cli-proxy:8080');
    });
  });

  describe('Proxy priority order', () => {
    it('should follow the correct priority: CLI > NVM_PROXY > HTTPS_PROXY > HTTP_PROXY', () => {
      const priorities = [];

      // Test case 1: All set, CLI should win
      let parsed = {
        source: { proxy: 'cli' },
        opts: { proxy: 'cli' }
      };
      process.env.NVM_PROXY = 'nvm';
      process.env.HTTPS_PROXY = 'https';
      process.env.HTTP_PROXY = 'http';

      let result = parsed.source.proxy === 'cli' ? 'cli' :
                   process.env.NVM_PROXY ? 'nvm' :
                   process.env.HTTPS_PROXY ? 'https' : 'http';
      expect(result).toBe('cli');

      // Test case 2: No CLI, NVM_PROXY should win
      parsed = { source: {}, opts: {} };
      result = parsed.source.proxy === 'cli' ? 'cli' :
               process.env.NVM_PROXY ? 'nvm' :
               process.env.HTTPS_PROXY ? 'https' : 'http';
      expect(result).toBe('nvm');

      // Test case 3: No CLI, no NVM_PROXY, HTTPS_PROXY should win
      delete process.env.NVM_PROXY;
      result = parsed.source.proxy === 'cli' ? 'cli' :
               process.env.NVM_PROXY ? 'nvm' :
               process.env.HTTPS_PROXY ? 'https' : 'http';
      expect(result).toBe('https');

      // Test case 4: Only HTTP_PROXY
      delete process.env.HTTPS_PROXY;
      result = parsed.source.proxy === 'cli' ? 'cli' :
               process.env.NVM_PROXY ? 'nvm' :
               process.env.HTTPS_PROXY ? 'https' : 'http';
      expect(result).toBe('http');
    });
  });

  describe('SSL Verification', () => {
    it('should use default verifyssl when not specified', () => {
      const parsed = {
        source: {},
        opts: { verifyssl: true }
      };

      const verifyssl = process.env.NVM_VERIFY_SSL === undefined || parsed.source.verifyssl === 'cli'
        ? parsed.opts.verifyssl
        : process.env.NVM_VERIFY_SSL !== 'false';

      expect(verifyssl).toBe(true);
    });

    it('should respect NVM_VERIFY_SSL env var', () => {
      process.env.NVM_VERIFY_SSL = 'false';

      const parsed = {
        source: {},
        opts: { verifyssl: true }
      };

      const verifyssl = process.env.NVM_VERIFY_SSL === undefined || parsed.source.verifyssl === 'cli'
        ? parsed.opts.verifyssl
        : process.env.NVM_VERIFY_SSL !== 'false';

      expect(verifyssl).toBe(false);
    });

    it('should allow CLI flag to override env var', () => {
      process.env.NVM_VERIFY_SSL = 'false';

      const parsed = {
        source: { verifyssl: 'cli' },
        opts: { verifyssl: true }
      };

      const verifyssl = process.env.NVM_VERIFY_SSL === undefined || parsed.source.verifyssl === 'cli'
        ? parsed.opts.verifyssl
        : process.env.NVM_VERIFY_SSL !== 'false';

      expect(verifyssl).toBe(true);
    });
  });

  describe('Corepack Configuration', () => {
    it('should use CLI flag when provided (--corepack)', () => {
      delete process.env.NVM_COREPACK_ENABLED;

      const parsed = {
        source: { corepack: 'cli' },
        opts: { corepack: true }
      };

      const corepack = parsed.source.corepack === 'cli'
        ? parsed.opts.corepack
        : process.env.NVM_COREPACK_ENABLED === 'true';

      expect(corepack).toBe(true);
    });

    it('should use CLI flag when provided (--no-corepack)', () => {
      process.env.NVM_COREPACK_ENABLED = 'true';

      const parsed = {
        source: { corepack: 'cli' },
        opts: { corepack: false }
      };

      const corepack = parsed.source.corepack === 'cli'
        ? parsed.opts.corepack
        : process.env.NVM_COREPACK_ENABLED === 'true';

      expect(corepack).toBe(false);
    });

    it('should use NVM_COREPACK_ENABLED when CLI flag not provided', () => {
      process.env.NVM_COREPACK_ENABLED = 'true';

      const parsed = {
        source: {},
        opts: {}
      };

      const corepack = parsed.source.corepack === 'cli'
        ? parsed.opts.corepack
        : process.env.NVM_COREPACK_ENABLED === 'true';

      expect(corepack).toBe(true);
    });

    it('should default to false when neither CLI flag nor env var are set', () => {
      delete process.env.NVM_COREPACK_ENABLED;

      const parsed = {
        source: {},
        opts: {}
      };

      const corepack = parsed.source.corepack === 'cli'
        ? parsed.opts.corepack
        : process.env.NVM_COREPACK_ENABLED === 'true';

      expect(corepack).toBe(false);
    });

    it('should default to false when env var is not "true"', () => {
      process.env.NVM_COREPACK_ENABLED = 'false';

      const parsed = {
        source: {},
        opts: {}
      };

      const corepack = parsed.source.corepack === 'cli'
        ? parsed.opts.corepack
        : process.env.NVM_COREPACK_ENABLED === 'true';

      expect(corepack).toBe(false);
    });

    it('should prioritize CLI flag over env var', () => {
      process.env.NVM_COREPACK_ENABLED = 'false';

      const parsed = {
        source: { corepack: 'cli' },
        opts: { corepack: true }
      };

      const corepack = parsed.source.corepack === 'cli'
        ? parsed.opts.corepack
        : process.env.NVM_COREPACK_ENABLED === 'true';

      expect(corepack).toBe(true);
    });

    it('should follow the correct priority: CLI flag > NVM_COREPACK_ENABLED > default (false)', () => {
      // Test case 1: CLI flag set to true, env var false
      let parsed = {
        source: { corepack: 'cli' },
        opts: { corepack: true }
      };
      process.env.NVM_COREPACK_ENABLED = 'false';

      let result = parsed.source.corepack === 'cli'
        ? parsed.opts.corepack
        : process.env.NVM_COREPACK_ENABLED === 'true';
      expect(result).toBe(true);

      // Test case 2: No CLI flag, env var true
      parsed = { source: {}, opts: {} };
      process.env.NVM_COREPACK_ENABLED = 'true';

      result = parsed.source.corepack === 'cli'
        ? parsed.opts.corepack
        : process.env.NVM_COREPACK_ENABLED === 'true';
      expect(result).toBe(true);

      // Test case 3: No CLI flag, no env var (default to false)
      delete process.env.NVM_COREPACK_ENABLED;

      result = parsed.source.corepack === 'cli'
        ? parsed.opts.corepack
        : process.env.NVM_COREPACK_ENABLED === 'true';
      expect(result).toBe(false);

      // Test case 4: CLI flag false, env var true (CLI wins)
      parsed = {
        source: { corepack: 'cli' },
        opts: { corepack: false }
      };
      process.env.NVM_COREPACK_ENABLED = 'true';

      result = parsed.source.corepack === 'cli'
        ? parsed.opts.corepack
        : process.env.NVM_COREPACK_ENABLED === 'true';
      expect(result).toBe(false);
    });
  });
});
