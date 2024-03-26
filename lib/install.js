"use strict";

/* eslint-disable max-statements, no-var, no-magic-numbers */

const util = require("util");
const opfs = require("opfs");
const path = require("path");
const _ = require("lodash");
const ck = require("chalker");
const extract = require("extract-zip");
const needle = require("needle");
const common = require("./common");
const tar = require("tar");

function getNodeCachePath(version) {
  return path.join(common.getNvmCacheDir(), version, common.cacheFileName());
}

async function matchNodeVersion({ version, proxy, verifyssl, lts }) {
  if (common.isFullVersion(version)) {
    return version;
  }

  try {
    const remoteVersions = await common.getRemoteFromJson(proxy, verifyssl, lts);

    return common.matchLatestVersion(version, remoteVersions);
  } catch (err) {
    common.log(
      ck`<red>You specified a partial version ${version}
but nvm was unable to fetch remote versions to match the latest.
Try to specify a full version to make nvm to skip this</>\n`,
      err
    );
    return common.exit(1);
  }
}

async function fetchNode(url, version, options) {
  try {
    const resp = await needle("get", url, options);
    if (resp.statusCode !== 200) {
      if (resp.statusCode === 404) {
        common.log(ck`<red>Error: node.js version <white>${version}</> not found.</>`);
      } else {
        common.log("response body", resp.body);
        common.log("response statusCode", resp.statusCode);
        common.log("response statusMessage", resp.statusMessage);
        common.log("Node %s downloaded failed, check above for error, status, and body", version);
      }
      return false;
    } else {
      common.log("downloaded successful");
      return true;
    }
  } catch (err) {
    common.log(ck`<red>download <white>${url}</> failed</>\n`, err);
    return false;
  }
}

async function downloadNode(version, proxy, verifyssl) {
  const nodeCachePath = getNodeCachePath(version);
  if (await common._exists(nodeCachePath)) {
    return true;
  }

  common.log(ck`<green>Downloading Node ${version}...</>`);

  const allDistUrls = common.getDistUrls();

  let downloaded;

  for (const baseUrl of allDistUrls) {
    const url = common.nodejsDistUrl(`${version}/${common.makeNodeDistFileName(version)}`, baseUrl);
    const options = {
      proxy,
      output: nodeCachePath,
      follow: 5,
      rejectUnauthorized: verifyssl
    };

    downloaded = await fetchNode(url, version, options);
    if (downloaded) {
      break;
    }
  }

  return downloaded;
}

async function doExtract(file, targetPath) {
  if (file.endsWith(".tgz")) {
    return tar.x({ cwd: targetPath, file });
  } else {
    return extract(file, { dir: targetPath });
  }
}

async function install(targetPath, version) {
  const nodeCachePath = getNodeCachePath(version);
  await opfs.$.mkdirp(targetPath);
  const nodeFileName = common.makeNodeDistName(version);

  common.log(ck`<white>Installing Node ${version}...</>`);
  if (!(await common._exists(nodeCachePath))) {
    return false;
  }

  try {
    await doExtract(nodeCachePath, targetPath);
    const srcDir = path.join(targetPath, nodeFileName);
    const destDir = path.join(targetPath, version);
    await common.rename(srcDir, destDir);
    common.log(ck`<green>Node.js ${version} installed.</>`);
    await common.createEnvironmentTmp(null, common.getSetInstallEnvScript(version));
  } catch (err) {
    try {
      await opfs.$.rimraf(path.join(targetPath, nodeFileName));
    } catch (e) {
      //
    }

    common.log(ck`<red>Node ${version} installed failed</>`, err);
    common.log(ck`<green>Try to clean cache with 'nvm cleanup' and try again.</>`);
  }

  return undefined;
}

module.exports = {
  downloadNode,
  install,
  doExtract,
  cmdInstall: async function(version, proxy, verifyssl) {
    version = common.replaceVersion(version);

    version = await matchNodeVersion({ version, proxy, verifyssl, lts: false });

    const versionParts = _.map(version.split("."), index => parseInt(index.replace("v", "")));

    if (versionParts[0] < 4 || (versionParts[0] === 4 && versionParts[1] < 5)) {
      common.log("Sorry but nvm can not install the Node version below v4.5.0");
      common.exit(1);
    }

    const nodeDir = common.getNodeDir(version);

    if (await common.dirHasNodeBin(nodeDir)) {
      common.log(ck`<red>Node.js version <white>${version}</> is already installed</>`);
      common.exit(1);
    }

    await opfs.$.mkdirp(path.join(common.getNvmCacheDir(), version));

    const status = await downloadNode(version, proxy, verifyssl);

    if (status === true) {
      if (await common._exists(nodeDir)) {
        try {
          await opfs.$.rimraf(nodeDir);
        } catch (err) {
          common.log(ck`<red>Node ${version} installed failed</>`, err);
          common.exit(1);
        }
      }

      await install(path.join(nodeDir, ".."), version);
    }
  }
};
