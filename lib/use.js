"use strict";

const ck = require("chalker");
const common = require("./common");
const fs = require("fs");

const versionFileNames = [".nvmrc", ".node-version"];

function isValidNodeVersion(version) {
  return /^v?\d+(\.\d+)*$/.test(version);
}

async function getNodeVersionFromFile() {
  // Try each file in order of priority
  for (const fileName of versionFileNames) {
    try {
      const version = (await fs.promises.readFile(fileName, "ascii")).trim();
      if (isValidNodeVersion(version)) {
        common.log(`Read version ${version} from ${fileName}`);
        return version;
      }
      common.log(ck`<red>Invalid version from ${fileName}: <white>${version}</>.</>`);
      common.exit(1);
    } catch (err) {
      if (err.code !== "ENOENT") {
        common.log(ck`<red>Failed reading ${fileName}: ${err.message}</>`);
        common.exit(1);
      }
      // File not found, try next file
    }
  }

  // None of the version files were found
  common.log(ck`<red>No ${versionFileNames.join(" or ")} file found</>`);
  common.exit(1);
}

module.exports = async function(ver, ignoreTmp) {
  if (!ver) {
    ver = await getNodeVersionFromFile();
    ver = ver?.replace("v", "").trim();
  }

  const { version, nodeDir } = await common.findNodeVersion(ver);

  if (ignoreTmp !== true) {
    await common.resetNvmPaths();
    common.setNvmUsePath(nodeDir);
    process.env.NVM_USE = version;
    await common.createEnvironmentTmp();
  }
  common.log(ck`<green>Now using node <white>${version}</>.</>`);

  return { version, nodeDir };
};
