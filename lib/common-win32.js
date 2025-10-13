"use strict";

/* eslint-disable no-magic-numbers, max-statements */

const os = require("os");
const path = require("path");
const xaa = require("xaa");
const opfs = require("opfs");

const REG_ENV_PATH = "HKCU\\Environment";
const NVM_HOME = "NVM_HOME";
const NVM_LINK = "NVM_LINK";
const NVM_HOME_DIR = process.env[NVM_HOME] || path.join(__dirname, "..");
const NVM_BIN_DIR = path.join(NVM_HOME_DIR, "bin");
const NVM_LINK_DIR = process.env[NVM_LINK] || path.join(NVM_HOME_DIR, "nodejs", "bin");

const getRegValue = (out, key) => {
  const lines = out.split("\r\n");
  const line = lines.find(x => x && x.trim().startsWith(key));
  if (line) {
    // Match: <key><whitespace><type><whitespace><value>
    // Registry output format: "    Path    REG_EXPAND_SZ    C:\Program Files\..."
    const match = line.trim().match(/^\S+\s+(REG_[A-Z_]+)\s+(.*)$/);
    if (match && match[2] !== undefined) {
      return match[2];
    }
  }
  return "";
};

const pathFromExec = execR => {
  return execR.ok ? getRegValue(execR.stdout.toString(), "Path") : "";
};

const makeNvmPath = (cPath, add) => {
  const paths = cPath.split(";").filter(x => x && !x.startsWith(NVM_HOME_DIR));
  const newPath = (add ? [NVM_BIN_DIR, NVM_LINK_DIR] : []).concat(paths).join(";");
  return newPath;
};

const newPathCmd = (cPath, add) => {
  const newPath = makeNvmPath(cPath, add);
  return newPath !== cPath
    ? `reg.exe add "${REG_ENV_PATH}" /t REG_EXPAND_SZ /v Path /d "${newPath}" /f
setx.exe Path "${newPath}"
`
    : "";
};

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
  },

  async initEnv() {
    // add NVM_HOME and NVM_LINK to regisry HKCU/Environment

    const curPathR = await this.exec("reg.exe", ["query", REG_ENV_PATH, "/v", "Path"]);
    const curHomeR = await this.exec("reg.exe", ["query", REG_ENV_PATH, "/v", NVM_HOME]);
    const curLinkR = await this.exec("reg.exe", ["query", REG_ENV_PATH, "/v", NVM_LINK]);

    const newHomeCmd = () => {
      const cHome = curHomeR.ok ? getRegValue(curHomeR.stdout.toString(), NVM_HOME) : "";
      return !cHome || cHome !== NVM_HOME_DIR
        ? `reg.exe add "${REG_ENV_PATH}" /t REG_SZ /v ${NVM_HOME} /d "${NVM_HOME_DIR}" /f
setx.exe ${NVM_HOME} "${NVM_HOME_DIR}"
`
        : "ECHO NVM_HOME already set in env";
    };
    const newLinkCmd = () => {
      const cLink = curLinkR.ok ? getRegValue(curLinkR.stdout.toString(), "NVM_LINK") : "";
      return !cLink || cLink !== NVM_LINK_DIR
        ? `reg.exe add "${REG_ENV_PATH}" /t REG_SZ /v ${NVM_LINK} /d "${NVM_LINK_DIR}" /f
setx.exe ${NVM_LINK} "${NVM_LINK_DIR}"
`
        : "ECHO NVM_LINK arealdy set in env";
    };

    await opfs.writeFile(
      path.join(NVM_HOME_DIR, "init-env.cmd"),
      `@ECHO OFF\r
${newHomeCmd()}\r
${newLinkCmd()}\r
${newPathCmd(pathFromExec(curPathR), true)}\r
`
    );
  },

  async undoEnv() {
    const curPathR = await this.exec("reg.exe", ["query", REG_ENV_PATH, "/v", "Path"]);

    await opfs.writeFile(
      path.join(NVM_HOME_DIR, "undo-env.cmd"),
      `@ECHO OFF\r
${newPathCmd(pathFromExec(curPathR), false)}\r
reg.exe DELETE "${REG_ENV_PATH}" /v ${NVM_HOME} /f\r
reg.exe DELETE "${REG_ENV_PATH}" /v ${NVM_LINK} /f\r
`
    );
  }
};
