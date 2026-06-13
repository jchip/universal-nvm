import { describe, it, expect, afterAll } from 'vitest';
import Path from 'path';
import { readFile, rm } from 'fs/promises';
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
});
