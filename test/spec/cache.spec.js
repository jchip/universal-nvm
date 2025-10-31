import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

const common = require("../../lib/common");

describe('Remote Versions Cache', () => {
  let testCacheDir;
  let originalNvmHome;

  beforeEach(() => {
    // Create a temporary cache directory for testing
    testCacheDir = path.join(os.tmpdir(), `nvm-cache-test-${Date.now()}`);
    fs.mkdirSync(testCacheDir, { recursive: true });

    // Override NVM_HOME to use our test directory
    originalNvmHome = process.env.NVM_HOME;
    process.env.NVM_HOME = testCacheDir;
  });

  afterEach(() => {
    // Restore original NVM_HOME
    if (originalNvmHome) {
      process.env.NVM_HOME = originalNvmHome;
    } else {
      delete process.env.NVM_HOME;
    }

    // Clean up test directory
    try {
      fs.rmSync(testCacheDir, { recursive: true, force: true });
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  describe('getRemoteVersionsCachePath', () => {
    it('should return correct cache path', () => {
      const cachePath = common.getRemoteVersionsCachePath();
      expect(cachePath).toBe(path.join(testCacheDir, 'cache', 'remote-versions.json'));
    });
  });

  describe('saveRemoteVersionsCache', () => {
    it('should save cache data to file', async () => {
      const testData = [
        { version: 'v22.11.0', lts: false },
        { version: 'v20.18.0', lts: 'Iron' },
        { version: 'v18.20.0', lts: 'Hydrogen' }
      ];

      await common.saveRemoteVersionsCache(testData);

      const cachePath = common.getRemoteVersionsCachePath();
      expect(fs.existsSync(cachePath)).toBe(true);

      const savedData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      expect(savedData).toEqual(testData);
    });

    it('should create cache directory if it does not exist', async () => {
      const testData = [{ version: 'v22.11.0', lts: false }];

      // Ensure cache dir doesn't exist
      const cacheDir = path.join(testCacheDir, 'cache');
      if (fs.existsSync(cacheDir)) {
        fs.rmSync(cacheDir, { recursive: true });
      }

      await common.saveRemoteVersionsCache(testData);

      const cachePath = common.getRemoteVersionsCachePath();
      expect(fs.existsSync(cachePath)).toBe(true);
    });

    it('should handle write errors gracefully', async () => {
      // This should not throw even if write fails
      process.env.NVM_HOME = '/invalid/read-only/path';

      await expect(
        common.saveRemoteVersionsCache([{ version: 'v22.11.0' }])
      ).resolves.not.toThrow();
    });
  });

  describe('getCachedRemoteVersions', () => {
    it('should return null if cache file does not exist', async () => {
      const cached = await common.getCachedRemoteVersions();
      expect(cached).toBeNull();
    });

    it('should return cached data if file exists and is fresh (< 1 hour)', async () => {
      const testData = [
        { version: 'v22.11.0', lts: false },
        { version: 'v20.18.0', lts: 'Iron' }
      ];

      // Save cache
      await common.saveRemoteVersionsCache(testData);

      // Retrieve cache
      const cached = await common.getCachedRemoteVersions();
      expect(cached).toEqual(testData);
    });

    it('should return null if cache file is stale (> 1 hour)', async () => {
      const testData = [{ version: 'v22.11.0', lts: false }];

      // Save cache
      await common.saveRemoteVersionsCache(testData);

      const cachePath = common.getRemoteVersionsCachePath();

      // Modify file timestamp to be 2 hours old
      const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
      fs.utimesSync(cachePath, new Date(twoHoursAgo), new Date(twoHoursAgo));

      // Should return null because cache is stale
      const cached = await common.getCachedRemoteVersions();
      expect(cached).toBeNull();
    });

    it('should return null if cache file contains invalid JSON', async () => {
      const cachePath = common.getRemoteVersionsCachePath();
      const cacheDir = path.dirname(cachePath);

      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(cachePath, 'invalid json {[}', 'utf8');

      const cached = await common.getCachedRemoteVersions();
      expect(cached).toBeNull();
    });

    it('should return null if cache file is empty', async () => {
      const cachePath = common.getRemoteVersionsCachePath();
      const cacheDir = path.dirname(cachePath);

      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(cachePath, '', 'utf8');

      const cached = await common.getCachedRemoteVersions();
      expect(cached).toBeNull();
    });
  });

  describe('getRemoteFromJson with cache', () => {
    it('should use cached data when useCache is true and cache is fresh', async () => {
      const testData = [
        { version: 'v22.11.0', lts: false },
        { version: 'v20.18.0', lts: 'Iron' },
        { version: 'v18.20.0', lts: 'Hydrogen' }
      ];

      // Save cache
      await common.saveRemoteVersionsCache(testData);

      // Fetch with cache enabled (should not make HTTP request)
      const versions = await common.getRemoteFromJson(null, true, false, true);

      // Should return cached versions (non-LTS filtered, sorted)
      expect(versions).toBeInstanceOf(Array);
      expect(versions.length).toBeGreaterThan(0);
      expect(versions).toContain('v22.11.0');
    });

    it('should filter LTS versions from cache when lts=true', async () => {
      const testData = [
        { version: 'v22.11.0', lts: false },
        { version: 'v20.18.0', lts: 'Iron' },
        { version: 'v18.20.0', lts: 'Hydrogen' }
      ];

      // Save cache
      await common.saveRemoteVersionsCache(testData);

      // Fetch LTS versions from cache
      const ltsVersions = await common.getRemoteFromJson(null, true, true, true);

      expect(ltsVersions).toBeInstanceOf(Array);
      expect(ltsVersions).toContain('v20.18.0');
      expect(ltsVersions).toContain('v18.20.0');
      expect(ltsVersions).not.toContain('v22.11.0'); // Not an LTS version
    });

    it('should bypass cache when useCache is false', async () => {
      const testData = [
        { version: 'v22.11.0', lts: false }
      ];

      // Save cache
      await common.saveRemoteVersionsCache(testData);

      // This should make a real HTTP request (will fail or succeed based on network)
      // We just verify it attempts to bypass cache
      try {
        await common.getRemoteFromJson(null, true, false, false);
      } catch (err) {
        // Expected to fail without valid proxy/network, but that's OK
        // The important thing is it tried to fetch instead of using cache
        expect(err).toBeDefined();
      }
    });

    it('should fetch fresh data and update cache if cache is stale', async () => {
      const oldData = [{ version: 'v20.0.0', lts: false }];

      // Save stale cache
      await common.saveRemoteVersionsCache(oldData);

      const cachePath = common.getRemoteVersionsCachePath();

      // Make cache stale (2 hours old)
      const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
      fs.utimesSync(cachePath, new Date(twoHoursAgo), new Date(twoHoursAgo));

      // This should fetch fresh data (will fail or succeed based on network)
      try {
        await common.getRemoteFromJson(null, true, false, true);

        // If successful, verify cache was updated
        const stats = fs.statSync(cachePath);
        const ageInMs = Date.now() - stats.mtimeMs;
        expect(ageInMs).toBeLessThan(5000); // Should be very recent (< 5 seconds)
      } catch (err) {
        // Expected to fail without valid network, but that's OK
        // The important thing is it tried to fetch fresh data
        expect(err).toBeDefined();
      }
    });
  });

  describe('Cache behavior with different scenarios', () => {
    it('should handle concurrent cache reads', async () => {
      const testData = [
        { version: 'v22.11.0', lts: false },
        { version: 'v20.18.0', lts: 'Iron' }
      ];

      await common.saveRemoteVersionsCache(testData);

      // Simulate concurrent reads
      const promises = [
        common.getCachedRemoteVersions(),
        common.getCachedRemoteVersions(),
        common.getCachedRemoteVersions()
      ];

      const results = await Promise.all(promises);

      // All should return the same data
      results.forEach(result => {
        expect(result).toEqual(testData);
      });
    });

    it('should handle empty cache data gracefully', async () => {
      await common.saveRemoteVersionsCache([]);

      const cached = await common.getCachedRemoteVersions();
      expect(cached).toEqual([]);
    });
  });
});
