"use strict";

const opfs = require("opfs");
const os = require("os");
const path = require("path");

// need to enclose path with " in case some dir has spaces in it
// How would such a thing happen?  WSL on Windows.
// so need to escape any " just in case, even WSL doesn't do this though.
function escapePath() {
  let pathStr = process.env.PATH || "";
  pathStr = pathStr.replace(/"/g, `\\"`);
  return pathStr;
}

module.exports = {
  getNodeBinDir(nodeDir) {
    return path.join(nodeDir, "bin");
  },

  makeNodeDistName(version) {
    const platform = os.platform().toLowerCase();
    const arch = os.arch().toLowerCase();
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
export PATH="${escapePath()}"
`
    );
  }
};
