"use strict";

/* eslint-disable no-magic-numbers, max-statements */

const os = require("os");
const path = require("path");
const xaa = require("xaa");
const fs = require("fs");

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

const newPathCmd = (cPath, add, readOk) => {
  // A successful reg.exe query that yields no value means we failed to parse a
  // populated Path (e.g. locale/format) -- rewriting it would drop the user's
  // real entries, so refuse rather than clobber. (A genuinely-absent user Path
  // makes reg.exe exit non-zero, i.e. readOk === false, and is safe to create.)
  if (readOk && !cPath) {
    return `ECHO Skipped updating Path: could not read the current HKCU Path value`;
  }
  const newPath = makeNvmPath(cPath, add);
  if (newPath === cPath) {
    return "";
  }
  // Escape % so REG_EXPAND_SZ references (e.g. %USERPROFILE%) survive as literals
  // instead of being expanded by cmd.exe when this .cmd runs.
  const escaped = newPath.replace(/%/g, "%%");
  // reg.exe only -- no setx: setx truncates values past 1024 chars and rewrites
  // this REG_EXPAND_SZ value as REG_SZ, both of which silently corrupt a long or
  // variable-bearing Path. reg add persists the full value; new sessions pick it
  // up, and the NVM_HOME setx below still broadcasts the environment change.
  return `reg.exe add "${REG_ENV_PATH}" /t REG_EXPAND_SZ /v Path /d "${escaped}" /f`;
};

// Quote a value as a PowerShell single-quoted string literal for safe inclusion
// in a generated .ps1 that gets dot-sourced. Single-quoted strings are literal
// in PowerShell (no $(...) subexpression or $var expansion); an embedded single
// quote is escaped by doubling it. This stops untrusted content (e.g. a hostile
// .nvmrc value carried in NVM_AUTO_USE_SHOWN_ERRORS) from executing when sourced.
const psQuote = value => `'${String(value == null ? "" : value).replace(/'/g, "''")}'`;

// Sanitize a value for a cmd.exe `SET "VAR=value"` assignment in a generated
// .cmd. Batch files have no reliable escaping, so strip the characters that can
// break out of the quoted SET or trigger expansion: double quote, percent
// (%VAR%), exclamation (delayed expansion) and CR/LF. Legitimate Node version
// specs and Windows PATH values never contain these.
const cmdSanitize = value => String(value == null ? "" : value).replace(/["%!\r\n]/g, "");

module.exports = {
  // Exported for unit testing of the PATH-rewrite generation (win32-only paths
  // that can't run in the cross-platform test suite otherwise).
  _getRegValue: getRegValue,
  _makeNvmPath: makeNvmPath,
  _newPathCmd: newPathCmd,

  // Workaround for pesky little issue with Windows and Node.js
  // It seems trying to rename a dir/file immediately after it's generated
  // could fail with EPERM and retrying again goes through.
  async rename(fromFile, toFile, retryCount = 0) {
    try {
      await fs.promises.rename(fromFile, toFile);
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
    let arch = os.arch().toLowerCase();

    if (arch === "arm64") {
      // Node ships official win-arm64 builds from v19.9.0 onward; earlier
      // versions have no arm64 artifact, so fall back to x64 (which runs under
      // Windows 11's ARM64 emulation) rather than 404 or a slow 32-bit x86.
      const [major, minor] = String(version)
        .replace(/^v/, "")
        .split(".")
        .map(n => parseInt(n, 10));
      const hasArm64 = major > 19 || (major === 19 && minor >= 9);
      arch = hasArm64 ? "arm64" : "x64";
    }

    if (arch === "x64") {
      return `node-${version}-win-x64`;
    } else if (arch === "arm64") {
      return `node-${version}-win-arm64`;
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
      return `$Env:NVM_INSTALL=${psQuote(version)}\r
$Env:Path=${psQuote(process.env.PATH || "")}\r
`;
    } else {
      return `@ECHO OFF\r
SET "NVM_INSTALL=${cmdSanitize(version)}"\r
SET "PATH=${cmdSanitize(process.env.PATH || "")}"\r
`;
    }
  },

  getDefaultEnvScript() {
    if (process.env.NVM_POWERSHELL) {
      return `$Env:NVM_USE=${psQuote(process.env.NVM_USE || "")}\r
$Env:NVM_AUTO_USE_SHOWN_ERRORS=${psQuote(process.env.NVM_AUTO_USE_SHOWN_ERRORS || "")}\r
$Env:Path=${psQuote(process.env.PATH || "")}\r
`;
    } else {
      return `@ECHO OFF\r
SET "NVM_USE=${cmdSanitize(process.env.NVM_USE || "")}"\r
SET "NVM_AUTO_USE_SHOWN_ERRORS=${cmdSanitize(process.env.NVM_AUTO_USE_SHOWN_ERRORS || "")}"\r
SET "PATH=${cmdSanitize(process.env.PATH || "")}"\r
`;
    }
  },

  async createEnvironmentTmp(filePath, content) {
    content = content || this.getDefaultEnvScript();
    // nvm.ps1 should set this env
    const filename = this.getEnvFile(process.env.NVM_POWERSHELL ? ".ps1" : ".cmd");

    filePath = filePath || path.join(this.getTmpdir(), filename);
    return await fs.promises.writeFile(filePath, content);
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

    await fs.promises.writeFile(
      path.join(NVM_HOME_DIR, "init-env.cmd"),
      `@ECHO OFF\r
${newHomeCmd()}\r
${newLinkCmd()}\r
${newPathCmd(pathFromExec(curPathR), true, curPathR.ok)}\r
`
    );
  },

  async undoEnv() {
    const curPathR = await this.exec("reg.exe", ["query", REG_ENV_PATH, "/v", "Path"]);

    await fs.promises.writeFile(
      path.join(NVM_HOME_DIR, "undo-env.cmd"),
      `@ECHO OFF\r
${newPathCmd(pathFromExec(curPathR), false, curPathR.ok)}\r
reg.exe DELETE "${REG_ENV_PATH}" /v ${NVM_HOME} /f\r
reg.exe DELETE "${REG_ENV_PATH}" /v ${NVM_LINK} /f\r
`
    );
  }
};
