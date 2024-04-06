"use strict";

/* eslint-disable no-magic-numbers, max-statements */

const os = require("os");
const path = require("path");
const xaa = require("xaa");
const opfs = require("opfs");

const REG_ENV_PATH = "HKCU\\Environment";

module.exports = {
  // Workaround for pesky little issue with Windows and Node.js
  // It seems trying to rename a dir/file immediately after it's generated
  // could fail with EPERM and retrying again goes through.
  async rename(fromFile, toFile, retryCount = 0) {
    try {
      await opfs.rename(fromFile, toFile);
    } catch (err) {
      if (err.code !== "EPERM" || retryCount >= 5) {
        throw err;
      }
      await xaa.delay(50);
      await this.rename(fromFile, toFile, retryCount + 1);
    }
  },

  getNodeBinDir(nodeDir) {
    return nodeDir;
  },

  makeNodeDistName(version) {
    if (os.arch().toLowerCase() === "x64") {
      return `node-${version}-win-x64`;
    } else {
      return `node-${version}-win-x86`;
    }
  },

  cacheFileName() {
    return "node.zip";
  },

  makeNodeDistFileName(version) {
    return `${this.makeNodeDistName(version)}.zip`;
  },

  async dirHasNodeBin(dir) {
    const nodeExe = path.join(dir, "node.exe");
    return await this._exists(nodeExe);
  },

  getSetInstallEnvScript(version) {
    if (process.env.NVM_POWERSHELL) {
      return `$Env:NVM_INSTALL="${version}"\r
$Env:Path="${process.env.PATH}"\r
`;
    } else {
      return `@ECHO OFF\r
SET "NVM_INSTALL=${version}"\r
SET "PATH=${process.env.PATH}"\r
`;
    }
  },

  getDefaultEnvScript() {
    if (process.env.NVM_POWERSHELL) {
      return `$Env:NVM_USE="${process.env.NVM_USE || ""}"\r
$Env:Path="${process.env.PATH}"\r
`;
    } else {
      return `@ECHO OFF\r
SET "NVM_USE=${process.env.NVM_USE || ""}"\r
SET "PATH=${process.env.PATH}"\r
`;
    }
  },

  async createEnvironmentTmp(filePath, content) {
    content = content || this.getDefaultEnvScript();
    // nvm.ps1 should set this env
    const filename = this.getEnvFile(process.env.NVM_POWERSHELL ? ".ps1" : ".cmd");

    filePath = filePath || path.join(this.getTmpdir(), filename);
    return await opfs.writeFile(filePath, content);
  },

  setNvmUsePath(nodeDir) {
    process.env.PATH = [nodeDir]
      .concat(process.env.PATH.split(path.delimiter))
      .filter(x => x)
      .join(path.delimiter);
  }
};
