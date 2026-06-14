"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const _ = require("lodash");

// Quote a value for safe inclusion in a POSIX shell script that gets
// `source`d/`eval`d by the shell wrappers (see createEnvironmentTmp /
// getSetInstallEnvScript consumers and bin/unvm.sh). Wrapping in single quotes
// and escaping any embedded single quote as '\'' neutralizes command
// substitution ($(...), backticks), variable expansion, ; & | redirection,
// globbing and newlines -- so untrusted content (e.g. a hostile .nvmrc /
// .node-version value carried through NVM_AUTO_USE_SHOWN_ERRORS) can never
// execute when the generated script is sourced. Also handles dirs with spaces.
function shQuote(value) {
  return `'${String(value == null ? "" : value).replace(/'/g, `'\\''`)}'`;
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
export PATH=${shQuote(process.env.PATH || "")}
export NVM_INSTALL=${shQuote(version)}
`;
  },

  async createEnvironmentTmp(filePath, content) {
    filePath = filePath || path.join(this.getTmpdir(), this.getEnvFile(".sh"));
    content =
      content ||
      `
export NVM_USE=${shQuote(process.env.NVM_USE || "")}
export NVM_AUTO_USE_SHOWN_ERRORS=${shQuote(process.env.NVM_AUTO_USE_SHOWN_ERRORS || "")}
export PATH=${shQuote(process.env.PATH || "")}
`;
    // Write a private temp file in the same directory, then rename(2) it into
    // place. rename is atomic on POSIX, so a shell sourcing this shared,
    // predictable path never reads a half-written script, and replacing the
    // target name (rather than writing through it) overwrites a pre-planted
    // symlink instead of following it. `wx` (O_CREAT|O_EXCL) + mode 0o600
    // creates a fresh owner-only temp and refuses a hostile symlink there too.
    const unique = `${process.pid}.${Math.random().toString(36).slice(2)}`;
    const tmpPath = `${filePath}.${unique}.tmp`;
    try {
      await fs.promises.writeFile(tmpPath, content, { mode: 0o600, flag: "wx" });
      await fs.promises.rename(tmpPath, filePath);
    } catch (err) {
      await fs.promises.unlink(tmpPath).catch(() => {});
      throw err;
    }
  }
};
