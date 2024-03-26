"use strict";

const Path = require("path");
const install = require("../../lib/install");
const fs = require("fs/promises");
const { expect } = require("chai");
const opfs = require("opfs");

describe("install", function() {
  const fixtureDir = Path.join(__dirname, "../fixtures/");
  const zipOutputDir = Path.join(fixtureDir, "foo");
  const zipFile = Path.join(fixtureDir, "foo.zip");

  after(async () => {
    opfs.$.rimraf(zipOutputDir);
  });

  it("doExtract should extract a zip file", async () => {
    await opfs.$.rimraf(zipOutputDir);
    await install.doExtract(zipFile, fixtureDir);
    const data = await fs.readFile(Path.join(zipOutputDir, "README.md"), "utf8");
    expect(data).contains("delete me");
  });
});
