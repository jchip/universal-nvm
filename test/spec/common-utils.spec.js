import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const common = require("../../lib/common");

describe("common utility functions", () => {
  describe("replaceVersion", () => {
    it("should add 'v' prefix to version without it", () => {
      expect(common.replaceVersion("18.20.0")).toBe("v18.20.0");
      expect(common.replaceVersion("22.10")).toBe("v22.10");
      expect(common.replaceVersion("20")).toBe("v20");
    });

    it("should preserve 'v' prefix if already present", () => {
      expect(common.replaceVersion("v18.20.0")).toBe("v18.20.0");
      expect(common.replaceVersion("v22.10")).toBe("v22.10");
      expect(common.replaceVersion("V20")).toBe("v20");
    });

    it("should handle case insensitive 'V' prefix", () => {
      expect(common.replaceVersion("V18.20.0")).toBe("v18.20.0");
    });

    it("should return undefined for null/undefined", () => {
      expect(common.replaceVersion(null)).toBeNull();
      expect(common.replaceVersion(undefined)).toBeUndefined();
    });
  });

  describe("isFullVersion", () => {
    it("should return true for full version (major.minor.patch)", () => {
      expect(common.isFullVersion("v18.20.0")).toBe(true);
      expect(common.isFullVersion("v22.10.1")).toBe(true);
      expect(common.isFullVersion("v1.2.3")).toBe(true);
    });

    it("should return false for partial versions", () => {
      expect(common.isFullVersion("v18.20")).toBe(false);
      expect(common.isFullVersion("v22")).toBe(false);
      expect(common.isFullVersion("v18")).toBe(false);
    });
  });

  describe("sortVersions", () => {
    it("should sort versions in ascending order", () => {
      const versions = ["v18.20.0", "v20.10.0", "v18.19.0", "v22.1.0"];
      const sorted = common.sortVersions(versions);

      expect(sorted).toEqual(["v18.19.0", "v18.20.0", "v20.10.0", "v22.1.0"]);
    });

    it("should sort versions with different major versions", () => {
      const versions = ["v22.0.0", "v18.0.0", "v20.0.0", "v16.0.0"];
      const sorted = common.sortVersions(versions);

      expect(sorted).toEqual(["v16.0.0", "v18.0.0", "v20.0.0", "v22.0.0"]);
    });

    it("should sort versions with same major, different minor", () => {
      const versions = ["v18.20.0", "v18.15.0", "v18.19.0", "v18.12.0"];
      const sorted = common.sortVersions(versions);

      expect(sorted).toEqual(["v18.12.0", "v18.15.0", "v18.19.0", "v18.20.0"]);
    });

    it("should sort versions with same major.minor, different patch", () => {
      const versions = ["v18.20.5", "v18.20.0", "v18.20.3", "v18.20.1"];
      const sorted = common.sortVersions(versions);

      expect(sorted).toEqual(["v18.20.0", "v18.20.1", "v18.20.3", "v18.20.5"]);
    });

    it("should handle empty array", () => {
      expect(common.sortVersions([])).toEqual([]);
    });

    it("should return non-array as-is", () => {
      expect(common.sortVersions(null)).toBe(null);
      expect(common.sortVersions(undefined)).toBe(undefined);
    });
  });

  describe("matchPartialVersions", () => {
    const allVersions = ["v18.19.0", "v18.20.0", "v18.20.1", "v20.10.0", "v20.11.0", "v22.1.0"];

    it("should match full version exactly", () => {
      const result = common.matchPartialVersions("v18.20.0", allVersions);
      expect(result).toEqual([["v18", "20", "0"]]);
    });

    it("should match major.minor partial version", () => {
      const result = common.matchPartialVersions("v18.20", allVersions);
      const joined = result.map(v => v.join("."));
      expect(joined).toEqual(["v18.20.0", "v18.20.1"]);
    });

    it("should match major partial version", () => {
      const result = common.matchPartialVersions("v18", allVersions);
      const joined = result.map(v => v.join("."));
      expect(joined).toEqual(["v18.19.0", "v18.20.0", "v18.20.1"]);
    });

    it("should return empty array for no matches", () => {
      const result = common.matchPartialVersions("v99", allVersions);
      expect(result).toEqual([]);
    });
  });

  describe("matchLatestVersion", () => {
    const allVersions = ["v18.19.0", "v18.20.0", "v18.20.1", "v20.10.0", "v20.11.0", "v22.1.0"];

    it("should return latest version for partial major version", () => {
      expect(common.matchLatestVersion("v18", allVersions)).toBe("v18.20.1");
      expect(common.matchLatestVersion("v20", allVersions)).toBe("v20.11.0");
    });

    it("should return latest version for partial major.minor version", () => {
      expect(common.matchLatestVersion("v18.20", allVersions)).toBe("v18.20.1");
    });

    it("should return exact version for full version", () => {
      expect(common.matchLatestVersion("v18.20.0", allVersions)).toBe("v18.20.0");
    });

    it("should return false for no matches", () => {
      expect(common.matchLatestVersion("v99", allVersions)).toBe(false);
    });
  });

  describe("matchOldestVersion", () => {
    const allVersions = ["v18.19.0", "v18.20.0", "v18.20.1", "v20.10.0", "v20.11.0", "v22.1.0"];

    it("should return oldest version for partial major version", () => {
      expect(common.matchOldestVersion("v18", allVersions)).toBe("v18.19.0");
      expect(common.matchOldestVersion("v20", allVersions)).toBe("v20.10.0");
    });

    it("should return oldest version for partial major.minor version", () => {
      expect(common.matchOldestVersion("v18.20", allVersions)).toBe("v18.20.0");
    });

    it("should return exact version for full version", () => {
      expect(common.matchOldestVersion("v18.20.1", allVersions)).toBe("v18.20.1");
    });

    it("should return input version for no matches", () => {
      expect(common.matchOldestVersion("v99", allVersions)).toBe("v99");
    });
  });

  describe("nodejsDistUrl", () => {
    it("should construct URL with default base", () => {
      const url = common.nodejsDistUrl("v18.20.0/node-v18.20.0-linux-x64.tar.gz");
      expect(url).toBe("http://nodejs.org/dist/v18.20.0/node-v18.20.0-linux-x64.tar.gz");
    });

    it("should construct URL with custom base", () => {
      const url = common.nodejsDistUrl("v18.20.0/node.exe", "https://npm.taobao.org/mirrors/node/");
      expect(url).toBe("https://npm.taobao.org/mirrors/node/v18.20.0/node.exe");
    });

    it("should handle trailing slash in base URL", () => {
      const url = common.nodejsDistUrl("index.json", "https://nodejs.org/dist/");
      expect(url).toBe("https://nodejs.org/dist/index.json");
    });

    it("should handle missing trailing slash in base URL", () => {
      const url = common.nodejsDistUrl("index.json", "https://nodejs.org/dist");
      expect(url).toContain("index.json");
    });

    it("should return base URL when pathname is empty", () => {
      const url = common.nodejsDistUrl("", "https://nodejs.org/dist/");
      expect(url).toBe("https://nodejs.org/dist/");
    });

    it("should return base URL when pathname is null", () => {
      const url = common.nodejsDistUrl(null, "https://nodejs.org/dist/");
      expect(url).toBe("https://nodejs.org/dist/");
    });
  });

  describe("getDistUrls", () => {
    let originalMirror;

    beforeEach(() => {
      originalMirror = process.env.NVM_NODEJS_ORG_MIRROR;
      common.distUrl = null;
    });

    afterEach(() => {
      if (originalMirror !== undefined) {
        process.env.NVM_NODEJS_ORG_MIRROR = originalMirror;
      } else {
        delete process.env.NVM_NODEJS_ORG_MIRROR;
      }
      common.distUrl = null;
    });

    it("should return default nodejs.org URL when no mirror is set", () => {
      delete process.env.NVM_NODEJS_ORG_MIRROR;
      const urls = common.getDistUrls();

      expect(urls).toEqual(["https://nodejs.org/dist"]);
    });

    it("should return mirror URL when NVM_NODEJS_ORG_MIRROR is set", () => {
      process.env.NVM_NODEJS_ORG_MIRROR = "https://npm.taobao.org/mirrors/node/";
      const urls = common.getDistUrls();

      expect(urls).toContain("https://npm.taobao.org/mirrors/node/");
      expect(urls).toContain("https://nodejs.org/dist");
    });

    it("should handle multiple mirrors separated by semicolon", () => {
      process.env.NVM_NODEJS_ORG_MIRROR = "https://mirror1.com;https://mirror2.com";
      const urls = common.getDistUrls();

      expect(urls).toContain("https://mirror1.com");
      expect(urls).toContain("https://mirror2.com");
      expect(urls).toContain("https://nodejs.org/dist");
    });

    it("should deduplicate URLs", () => {
      process.env.NVM_NODEJS_ORG_MIRROR = "https://nodejs.org/dist;https://nodejs.org/dist";
      const urls = common.getDistUrls();

      expect(urls).toEqual(["https://nodejs.org/dist"]);
    });

    it("should return custom distUrl if set", () => {
      common.setDistUrl("https://custom.mirror.com/node/");
      const urls = common.getDistUrls();

      expect(urls).toEqual(["https://custom.mirror.com/node/"]);
    });
  });

  describe("setDistUrl and getDistUrl", () => {
    afterEach(() => {
      common.distUrl = null;
    });

    it("should set and get custom dist URL", () => {
      common.setDistUrl("https://custom.mirror.com/");
      expect(common.getDistUrl()).toBe("https://custom.mirror.com/");
    });

    it("should return undefined when not set", () => {
      common.distUrl = null;
      expect(common.getDistUrl()).toBeNull();
    });
  });

  describe("getTmpdir", () => {
    let originalTmpdir;

    beforeEach(() => {
      originalTmpdir = process.env.NVM_TMPDIR;
    });

    afterEach(() => {
      if (originalTmpdir !== undefined) {
        process.env.NVM_TMPDIR = originalTmpdir;
      } else {
        delete process.env.NVM_TMPDIR;
      }
    });

    it("should return NVM_TMPDIR when set", () => {
      process.env.NVM_TMPDIR = "/custom/tmp";
      expect(common.getTmpdir()).toBe("/custom/tmp");
    });

    it("should return os.tmpdir() when NVM_TMPDIR not set", () => {
      delete process.env.NVM_TMPDIR;
      const tmpdir = common.getTmpdir();
      expect(tmpdir).toBeTruthy();
      expect(typeof tmpdir).toBe("string");
    });
  });

  describe("getRunId", () => {
    let originalRunId;

    beforeEach(() => {
      originalRunId = process.env.NVM_RUN_ID;
    });

    afterEach(() => {
      if (originalRunId !== undefined) {
        process.env.NVM_RUN_ID = originalRunId;
      } else {
        delete process.env.NVM_RUN_ID;
      }
    });

    it("should return NVM_RUN_ID when set", () => {
      process.env.NVM_RUN_ID = "12345";
      expect(common.getRunId()).toBe("12345");
    });

    it("should return empty string when NVM_RUN_ID not set", () => {
      delete process.env.NVM_RUN_ID;
      expect(common.getRunId()).toBe("");
    });
  });

  describe("getEnvFile", () => {
    let originalRunId;

    beforeEach(() => {
      originalRunId = process.env.NVM_RUN_ID;
    });

    afterEach(() => {
      if (originalRunId !== undefined) {
        process.env.NVM_RUN_ID = originalRunId;
      } else {
        delete process.env.NVM_RUN_ID;
      }
    });

    it("should return env file name without run ID", () => {
      delete process.env.NVM_RUN_ID;
      expect(common.getEnvFile()).toBe("nvm_env");
    });

    it("should return env file name with run ID", () => {
      process.env.NVM_RUN_ID = "123";
      expect(common.getEnvFile()).toBe("nvm_env123");
    });

    it("should return env file name with extension", () => {
      delete process.env.NVM_RUN_ID;
      expect(common.getEnvFile(".cmd")).toBe("nvm_env.cmd");
    });

    it("should return env file name with run ID and extension", () => {
      process.env.NVM_RUN_ID = "456";
      expect(common.getEnvFile(".ps1")).toBe("nvm_env456.ps1");
    });
  });
});
