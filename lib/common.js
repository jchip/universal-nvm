"use strict";

/* eslint-disable no-magic-numbers, max-statements, max-len */

const os = require("os");
const path = require("path");
const posix = require("./common-posix");
const win32 = require("./common-win32");
const _ = require("lodash");
const needle = require("needle");
const Url = require("url");
const xaa = require("xaa");
const ck = require("chalker");
const opfs = require("opfs");
const { spawn } = require("node:child_process");
const semver = require("semver");

// Determine which platform module to use based on --shell argument:
// - --shell=bash: passed by nvm.sh → use posix
// - --shell=powershell: passed by nvm.ps1 → use win32
// - --shell=cmd: passed by nvm.cmd → use win32
// - Default: win32 on Windows, posix elsewhere

// Extract shell type from --shell=<value> argument and remove it from argv
const shellArgIndex = process.argv.findIndex(arg => arg.startsWith('--shell='));
const shellType = shellArgIndex !== -1 ? process.argv[shellArgIndex].split('=')[1] : null;

// Remove --shell argument from argv so CLI parser doesn't see it
if (shellArgIndex !== -1) {
  process.argv.splice(shellArgIndex, 1);
}

const platformCommon = shellType === 'bash'
  ? posix
  : (shellType === 'powershell' || shellType === 'cmd' ? win32 : (os.platform() === "win32" ? win32 : posix));

const common = {
  getTmpdir() {
    return process.env.NVM_TMPDIR || os.tmpdir();
  },

  getRunId() {
    return process.env.NVM_RUN_ID || "";
  },

  getEnvFile(ext = "") {
    return `nvm_env${common.getRunId()}${ext}`;
  },

  async _exists(pathName) {
    try {
      await opfs.access(pathName, opfs.constants.F_OK);
      return true;
    } catch (e) {
      return false;
    }
  },

  rename: opfs.rename,

  exit(code) {
    process.exit(code); // eslint-disable-line
  },

  log(...args) {
    console.log(...args); // eslint-disable-line
  },

  logProxyInfo(proxy, source) {
    if (proxy) {
      this.log(ck`<cyan>Using proxy <white>${proxy}</> <dim>(from ${source})</dim></>`);
    }
  },

  replaceVersion(version) {
    if (version) {
      version = version.toLowerCase();
      return /^v/i.test(version) ? version : `v${version}`;
    }
    return version;
  },

  getHomeDir() {
    return os.homedir();
  },

  getBaseDir() {
    return process.env.NVM_HOME || path.join(this.getHomeDir(), "nvm");
  },

  getNvmLinkDir() {
    return process.env.NVM_LINK || path.join(this.getBaseDir(), "nodejs", "bin");
  },

  getNvmCacheDir() {
    return path.join(this.getBaseDir(), "cache");
  },

  getNvmDir() {
    return path.join(this.getBaseDir(), "nodejs");
  },

  getNodeDir(version) {
    return path.join(this.getNvmDir(), this.replaceVersion(version));
  },

  async resetNvmPaths() {
    const baseDir = this.getBaseDir();
    const linkDir = this.getNvmLinkDir();
    const paths = await xaa.filter(process.env.PATH.split(path.delimiter), async x => {
      if (x.startsWith(baseDir) || x === linkDir) {
        return false;
      }
      // remove any path that contains node executable
      return !(await this.dirHasNodeBin(x));
    });
    // update path with nvm's bin
    process.env.PATH = paths.concat(path.join(baseDir, "bin")).join(path.delimiter);
  },

  setNvmUsePath(nodeDir) {
    process.env.PATH = [platformCommon.getNodeBinDir(nodeDir)]
      .concat(process.env.PATH.split(path.delimiter))
      .filter(x => x)
      .join(path.delimiter);
  },

  async setNvmLinkPath() {
    const link = process.env.NVM_LINK;
    if (link && (await this._exists(link))) {
      process.env.PATH = [link]
        .concat(process.env.PATH.split(path.delimiter))
        .filter(x => x)
        .join(path.delimiter);
    }
  },

  async findNodeVersion(ver, oldest) {
    let version = this.replaceVersion(ver);

    if (!this.isFullVersion(version)) {
      const versions = await this.findLocalVersions();
      version = oldest
        ? this.matchOldestVersion(version, versions)
        : this.matchLatestVersion(version, versions);
      if (!version) {
        this.log(ck`<red>can't find an installed node.js version that matches ${ver}</red>`);
        this.log(`Available versions: ${versions.join(" ")}`);
        this.exit(1); // eslint-disable-line
      }
    }

    const nodeDir = this.getNodeDir(version);

    if ((await this._exists(nodeDir)) === false) {
      this.log(ck`<red>node.js version ${ver} is not installed yet</>`);
      this.exit(1); // eslint-disable-line
    }

    return { version, nodeDir };
  },

  sortVersions(versions) {
    if (_.size(versions) <= 0 || _.isArray(versions) === false) {
      return versions;
    }

    // Use semver.sort for proper semantic version sorting
    return semver.sort(versions);
  },

  async findLinkVersion() {
    let linkVersion;
    const link = this.getNvmLinkDir();
    if (link && (await this._exists(link))) {
      linkVersion = (await opfs.readlink(link)).match(/(v[0-9]+\.[0-9]+\.[0-9]+)/)[0];
    }

    return linkVersion;
  },

  async findLocalVersions() {
    const nvmDir = this.getNvmDir();
    let versions = [];

    if ((await this._exists(nvmDir)) && (await opfs.lstat(nvmDir)).isDirectory()) {
      versions = this.sortVersions(
        (await opfs.readdir(nvmDir)).filter(x => x && x !== "bin" && x.startsWith("v"))
      );
    }

    return versions;
  },

  isFullVersion(version) {
    return version.split(".").length === 3;
  },

  /**
   * Convert partial version to semver range
   * Examples:
   *   "v20" → "20.x.x"
   *   "v20.10" → "20.10.x"
   *   "v20.10.0" → "20.10.0"
   */
  partialVersionToRange(version) {
    // Remove 'v' prefix for semver operations
    const versionWithoutV = version.replace(/^v/, "");
    const parts = versionWithoutV.split(".");

    if (parts.length === 1) {
      // "20" → "20.x.x"
      return `${parts[0]}.x.x`;
    } else if (parts.length === 2) {
      // "20.10" → "20.10.x"
      return `${parts[0]}.${parts[1]}.x`;
    }

    // Already a full version
    return versionWithoutV;
  },

  matchPartialVersions(version, all) {
    const range = this.partialVersionToRange(version);
    const matching = all.filter(v => semver.satisfies(v, range));

    // Return in the old format for backward compatibility with tests
    // Keep the 'v' prefix in the first part when splitting
    return matching.map(v => {
      const parts = v.split(".");
      return parts;
    });
  },

  matchLatestVersion(version, all) {
    const range = this.partialVersionToRange(version);
    const matching = semver.maxSatisfying(all, range);

    return matching || false;
  },

  matchOldestVersion(version, all) {
    const range = this.partialVersionToRange(version);
    const matching = semver.minSatisfying(all, range);

    return matching || version;
  },

  nodejsDistUrl(pathname, distUrl = "http://nodejs.org/dist/") {
    if (pathname) {
      const urlObj = Url.parse(distUrl);
      urlObj.pathname = path.posix.join(urlObj.pathname, pathname);
      return Url.format(urlObj);
    }

    return distUrl;
  },

  getDistUrls() {
    if (this.distUrl) {
      return [this.distUrl];
    }

    return _.uniq(
      []
        .concat((process.env.NVM_NODEJS_ORG_MIRROR || "").split(";"), "https://nodejs.org/dist")
        .filter(x => x)
    );
  },

  setDistUrl(url) {
    this.distUrl = url;
  },

  getDistUrl() {
    return this.distUrl;
  },

  async getRemoteFromJson(proxy, verifyssl, lts) {
    const options = {
      proxy,
      rejectUnauthorized: verifyssl
    };

    const allBaseUrls = this.getDistUrls();

    let failureErr;
    for (const baseUrl of allBaseUrls) {
      const url = this.nodejsDistUrl("index.json", baseUrl);
      try {
        if (failureErr) {
          common.log(ck`<green>trying to fetch again from <white>${url}</></>`);
        }
        const resp = await needle("get", url, options);

        if (resp.statusCode !== 200) {
          common.log(
            ck`<red>fetching remote versions from <white>${url}</> returned status ${resp.statusCode}</>`
          );
          failureErr = new Error(
            `fetching versions from ${url} returned status ${resp.statusCode}`
          );
        } else {
          let versions = lts ? resp.body.filter(x => x.lts) : resp.body;

          versions = versions.map(x => x.version);
          versions = this.sortVersions(versions);

          this.setDistUrl(baseUrl);

          return versions;
        }
      } catch (err) {
        common.log(
          ck`<red>fetching remote versions from <white>${url}</> failed</>\n`,
          ` Error: ${err.message}`
        );
        failureErr = err;
      }
    }

    throw failureErr;
  },

  async getRemoteFromHtml(proxy, verifyssl) {
    const options = {
      proxy,
      rejectUnauthorized: verifyssl
    };

    const resp = await needle("get", this.nodejsDistUrl(), options);
    const versions = this.sortVersions(
      _.uniq(
        _.filter(resp.body.match(/v[0-9]+.[0-9]+.[0-9]+/gi), version => {
          return /^(v0.[0-4].[0-9]+)|(v0.5.0)$/i.test(version) === false;
        })
      )
    );

    return versions;
  },

  async getActiveVersion() {
    if (process.env.NVM_USE) {
      return process.env.NVM_USE;
    } else {
      return await common.findLinkVersion();
    }
  },

  async exec(command, args, options) {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, { windowsHide: true, ...options });
      const stderr = [];
      const stdout = [];
      process.stderr.on("data", data => {
        stderr.push(data);
      });
      process.stdout.on("data", data => {
        stdout.push(data);
      });
      process.on("error", error => {
        reject(error);
      });
      process.on("exit", code => {
        resolve({
          stderr: Buffer.concat(stderr),
          stdout: Buffer.concat(stdout),
          code,
          ok: code === 0
        });
      });
    });
  },

  async initEnv() {},
  async undoEnv() {}
};

module.exports = Object.assign(common, platformCommon);
