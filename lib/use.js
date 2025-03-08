"use strict";

const ck = require("chalker");
const common = require("./common");
const fs = require("fs");

const nvmrcFileName = ".nvmrc";

function isValidNodeVersion(version) {
  return /^v?\d+(\.\d+)*$/.test(version);
}

async function getNodeVersionFromNvmrcFile() {
  try {
    const version = (await fs.promises.readFile(nvmrcFileName, "ascii")).trim();
    if (isValidNodeVersion(version)) {
      common.log(`Read version ${version} from ${nvmrcFileName}`);
      return version;
    }
    common.log(ck`<red>Invalid version from ${nvmrcFileName}: <white>${version}</>.</>`);
  } catch (err) {
    if (err.code !== "ENOENT") {
      common.log(ck`<red>Failed reading ${nvmrcFileName}: ${err.message}</>`);
    } else {
      common.log(ck`<red>No ${nvmrcFileName} file found</>`);
    }
  }
  common.exit(1);
}

module.exports = async function(ver, ignoreTmp) {
  if (!ver) {
    ver = await getNodeVersionFromNvmrcFile();
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
