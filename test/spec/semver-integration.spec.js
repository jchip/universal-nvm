import { describe, it, expect } from 'vitest';

const common = require("../../lib/common");

describe("Semver Integration Tests", () => {
  describe("Version matching with real-world scenarios", () => {
    const typicalVersions = [
      "v16.20.0", "v16.20.1", "v16.20.2",
      "v18.12.0", "v18.19.0", "v18.19.1", "v18.20.0", "v18.20.1", "v18.20.2",
      "v20.9.0", "v20.10.0", "v20.11.0", "v20.11.1", "v20.12.0", "v20.12.2",
      "v22.0.0", "v22.1.0", "v22.2.0", "v22.3.0",
      "v24.0.0", "v24.1.0"
    ];

    describe("LTS version selection", () => {
      it("should select latest 18.x LTS version", () => {
        const result = common.matchLatestVersion("v18", typicalVersions);
        expect(result).toBe("v18.20.2");
      });

      it("should select latest 20.x LTS version", () => {
        const result = common.matchLatestVersion("v20", typicalVersions);
        expect(result).toBe("v20.12.2");
      });

      it("should select oldest 18.x version", () => {
        const result = common.matchOldestVersion("v18", typicalVersions);
        expect(result).toBe("v18.12.0");
      });
    });

    describe("Patch version selection", () => {
      it("should select latest patch for v18.20.x", () => {
        const result = common.matchLatestVersion("v18.20", typicalVersions);
        expect(result).toBe("v18.20.2");
      });

      it("should select latest patch for v20.11.x", () => {
        const result = common.matchLatestVersion("v20.11", typicalVersions);
        expect(result).toBe("v20.11.1");
      });

      it("should select oldest patch for v18.20.x", () => {
        const result = common.matchOldestVersion("v18.20", typicalVersions);
        expect(result).toBe("v18.20.0");
      });
    });

    describe("Edge cases", () => {
      it("should handle single-digit major versions", () => {
        const oldVersions = ["v4.9.0", "v4.9.1", "v6.17.0", "v6.17.1"];
        expect(common.matchLatestVersion("v4", oldVersions)).toBe("v4.9.1");
        expect(common.matchLatestVersion("v6", oldVersions)).toBe("v6.17.1");
      });

      it("should handle versions with double-digit minor/patch", () => {
        const versions = ["v18.10.0", "v18.11.0", "v18.12.0"];
        expect(common.matchLatestVersion("v18", versions)).toBe("v18.12.0");
      });

      it("should handle no matching versions", () => {
        expect(common.matchLatestVersion("v99", typicalVersions)).toBe(false);
        expect(common.matchLatestVersion("v25", typicalVersions)).toBe(false);
      });
    });
  });

  describe("Sorting edge cases", () => {
    it("should correctly sort versions with varying digit lengths", () => {
      const versions = [
        "v0.10.48", "v0.12.18",
        "v4.9.1", "v6.17.1", "v8.17.0",
        "v10.24.1", "v12.22.12", "v14.21.3",
        "v16.20.2", "v18.20.1", "v20.12.0"
      ];

      const sorted = common.sortVersions([...versions].reverse());
      expect(sorted).toEqual(versions);
    });

    it("should handle versions with large patch numbers", () => {
      const versions = ["v12.22.1", "v12.22.12", "v12.22.2", "v12.22.9"];
      const sorted = common.sortVersions(versions);

      expect(sorted).toEqual(["v12.22.1", "v12.22.2", "v12.22.9", "v12.22.12"]);
    });

    it("should handle duplicate versions", () => {
      const versions = ["v18.20.0", "v18.20.0", "v18.20.1"];
      const sorted = common.sortVersions(versions);

      expect(sorted).toEqual(["v18.20.0", "v18.20.0", "v18.20.1"]);
    });
  });

  describe("Real-world version patterns", () => {
    it("should handle typical Node.js 18.x release pattern", () => {
      const v18Releases = [
        "v18.0.0", "v18.1.0", "v18.2.0",
        "v18.12.0", "v18.12.1",
        "v18.13.0", "v18.14.0", "v18.14.1", "v18.14.2",
        "v18.15.0", "v18.16.0", "v18.16.1",
        "v18.17.0", "v18.17.1",
        "v18.18.0", "v18.18.1", "v18.18.2",
        "v18.19.0", "v18.19.1",
        "v18.20.0", "v18.20.1", "v18.20.2"
      ];

      const sorted = common.sortVersions([...v18Releases].reverse());
      expect(sorted).toEqual(v18Releases);

      expect(common.matchLatestVersion("v18", v18Releases)).toBe("v18.20.2");
      expect(common.matchLatestVersion("v18.19", v18Releases)).toBe("v18.19.1");
      expect(common.matchOldestVersion("v18.18", v18Releases)).toBe("v18.18.0");
    });

    it("should handle Node.js 20.x LTS release pattern", () => {
      const v20Releases = [
        "v20.0.0", "v20.1.0", "v20.2.0", "v20.3.0",
        "v20.9.0", "v20.10.0", "v20.11.0", "v20.11.1",
        "v20.12.0", "v20.12.1", "v20.12.2"
      ];

      expect(common.matchLatestVersion("v20", v20Releases)).toBe("v20.12.2");
      expect(common.matchLatestVersion("v20.11", v20Releases)).toBe("v20.11.1");
      expect(common.matchOldestVersion("v20", v20Releases)).toBe("v20.0.0");
    });
  });

  describe("Version range conversion", () => {
    it("should convert partial versions to correct x.x patterns", () => {
      expect(common.partialVersionToRange("v20")).toBe("20.x.x");
      expect(common.partialVersionToRange("v20.11")).toBe("20.11.x");
      expect(common.partialVersionToRange("v20.11.1")).toBe("20.11.1");
    });

    it("should handle versions without v prefix", () => {
      expect(common.partialVersionToRange("20")).toBe("20.x.x");
      expect(common.partialVersionToRange("20.11")).toBe("20.11.x");
      expect(common.partialVersionToRange("20.11.1")).toBe("20.11.1");
    });

    it("should handle old Node.js versions", () => {
      expect(common.partialVersionToRange("v0.10")).toBe("0.10.x");
      expect(common.partialVersionToRange("v0.12")).toBe("0.12.x");
      expect(common.partialVersionToRange("v4")).toBe("4.x.x");
      expect(common.partialVersionToRange("v6")).toBe("6.x.x");
    });
  });

  describe("matchPartialVersions backwards compatibility", () => {
    const versions = ["v18.19.0", "v18.20.0", "v18.20.1", "v20.10.0"];

    it("should return array of split version parts", () => {
      const result = common.matchPartialVersions("v18.20", versions);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0]).toEqual(["v18", "20", "0"]);
      expect(result[1]).toEqual(["v18", "20", "1"]);
    });

    it("should work with major version only", () => {
      const result = common.matchPartialVersions("v18", versions);

      expect(result.length).toBe(3);
      expect(result.map(v => v.join("."))).toEqual([
        "v18.19.0",
        "v18.20.0",
        "v18.20.1"
      ]);
    });

    it("should return empty array for no matches", () => {
      const result = common.matchPartialVersions("v99", versions);
      expect(result).toEqual([]);
    });
  });

  describe("Performance with large version lists", () => {
    it("should handle 100+ versions efficiently", () => {
      // Generate 100+ realistic versions
      const versions = [];
      for (let major = 16; major <= 24; major++) {
        for (let minor = 0; minor < 5; minor++) {
          for (let patch = 0; patch < 3; patch++) {
            versions.push(`v${major}.${minor}.${patch}`);
          }
        }
      }

      const start = Date.now();
      const sorted = common.sortVersions([...versions].reverse());
      const sortTime = Date.now() - start;

      expect(sorted[0]).toBe("v16.0.0");
      expect(sorted[sorted.length - 1]).toBe("v24.4.2");
      expect(sortTime).toBeLessThan(100); // Should be very fast
    });

    it("should match versions quickly from large list", () => {
      const versions = [];
      for (let major = 10; major <= 24; major++) {
        for (let minor = 0; minor < 10; minor++) {
          versions.push(`v${major}.${minor}.0`);
        }
      }

      const start = Date.now();
      const result = common.matchLatestVersion("v20", versions);
      const matchTime = Date.now() - start;

      expect(result).toBe("v20.9.0");
      expect(matchTime).toBeLessThan(50); // Should be very fast
    });
  });
});
