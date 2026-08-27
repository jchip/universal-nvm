import { describe, it, expect, afterAll } from 'vitest';
import os from 'os';
import Path from 'path';
import { readFile, rm, mkdtemp } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const install = require("../../lib/install");

describe("install", () => {
  const fixtureDir = Path.join(__dirname, "../fixtures/");
  const zipOutputDir = Path.join(fixtureDir, "foo");
  const zipFile = Path.join(fixtureDir, "foo.zip");

  afterAll(async () => {
    await rm(zipOutputDir, { recursive: true, force: true });
  });

  it("doExtract should extract a zip file", async () => {
    await rm(zipOutputDir, { recursive: true, force: true });
    await install.doExtract(zipFile, fixtureDir);
    const data = await readFile(Path.join(zipOutputDir, "README.md"), "utf8");
    expect(data).toContain("delete me");
  });

  it("doExtract should reject a zip-slip archive (entry escaping target dir)", async () => {
    // zip-slip.zip contains '../evil.txt'; the zip source is user-configurable
    // via NVM_NODEJS_ORG_MIRROR, so traversal entries must never extract
    const targetPath = await mkdtemp(Path.join(os.tmpdir(), "nvm-zipslip-"));
    const escapedFile = Path.join(targetPath, "..", "evil.txt");
    try {
      await expect(
        install.doExtract(Path.join(fixtureDir, "zip-slip.zip"), targetPath)
      ).rejects.toThrow(/entry|path|invalid|malicious/i);
      await expect(readFile(escapedFile, "utf8")).rejects.toThrow();
    } finally {
      await rm(targetPath, { recursive: true, force: true });
      await rm(escapedFile, { force: true });
    }
  });

  it("install() returns false when the cached archive is missing", async () => {
    // Regression: install() used to return undefined on failure, so cmdInstall
    // could not tell success from failure and exited 0 on a failed install.
    const targetPath = await mkdtemp(Path.join(os.tmpdir(), "nvm-install-test-"));
    try {
      const result = await install.install(targetPath, "v0.0.0-does-not-exist", false);
      expect(result).toBe(false);
    } finally {
      await rm(targetPath, { recursive: true, force: true });
    }
  });
});
