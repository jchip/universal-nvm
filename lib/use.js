"use strict";

const ck = require("chalker");
const common = require("./common");
const autoUse = require("./auto-use");

module.exports = async function(ver, ignoreTmp) {
  // If no version specified, use auto-use logic
  if (!ver) {
    return await autoUse({ silent: false, verbose: false, prefix: "from" });
  }

  // Explicit version specified - always switch
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
