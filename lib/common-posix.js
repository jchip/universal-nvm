"use strict";

const opfs = require("opfs");
const os = require("os");
const path = require("path");
const _ = require("lodash");

// need to enclose path with " in case some dir has spaces in it
// How would such a thing happen?  WSL on Windows.
// so need to escape any " just in case, even WSL doesn't do this though.
function escapePath() {
  let pathStr = process.env.PATH || "";

  // Note: Shell detection is now done via --shell=bash argument passed from nvm.sh
  // When running on Git Bash on Windows, the posix module is selected via platformCommon
  // in lib/common.js, and path conversion is handled automatically by the bash environment

  pathStr = pathStr.replace(/"/g, `\\"`);
  return pathStr;
}

module.exports = {
  getNodeBinDir(nodeDir) {
    // On Windows (even with Git Bash), node.exe is in the version directory, not in a bin subdirectory
    if (process.platform === "win32") {
      return nodeDir;
    }
    return path.join(nodeDir, "bin");
  },

  makeNodeDistName(version) {
    const platform = os.platform().toLowerCase();
    let arch = os.arch().toLowerCase();

    if (arch === "arm64" && platform === "darwin") {
      const versionParts = _.map(version.split("."), index => parseInt(index.replace("v", "")));
      if (versionParts[0] < 16) {
        this.log(
          `Version ${version} (major ${versionParts[0]} < 16) falling back to x64 for ${platform} ${arch}`
        );
        // there is no prebuilt binary available for apple silicon before version 16
        // use x64 instead, which can run with rosetta
        arch = "x64";
      }
    }

    return `node-${version}-${platform}-${arch}`;
  },

  cacheFileName() {
    return "node.tgz";
  },

  makeNodeDistFileName(version) {
    const distName = this.makeNodeDistName(version);
    return `${distName}.tar.gz`;
  },

  async dirHasNodeBin(dir) {
    const nodeExe = path.join(dir, "bin", "node");
    return await this._exists(nodeExe);
  },

  getSetInstallEnvScript(version) {
    return `
export PATH="${escapePath()}"
export NVM_INSTALL=${version}
`;
  },

  async createEnvironmentTmp(filePath, content) {
    filePath = filePath || path.join(this.getTmpdir(), this.getEnvFile(".sh"));
    await opfs.writeFile(
      filePath,
      content ||
        `
export NVM_USE=${process.env.NVM_USE || ""}
export NVM_AUTO_USE_SHOWN_ERRORS="${process.env.NVM_AUTO_USE_SHOWN_ERRORS || ""}"
export PATH="${escapePath()}"
`
    );
  }
};
