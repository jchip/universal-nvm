"use strict";

/* eslint-disable max-statements */

const opfs = require("opfs");
const path = require("path");
const common = require("./common");
const ck = require("chalker");

module.exports = async function(ver) {
  const link = common.getNvmLinkDir();

  if (!link) {
    common.log(ck`<red>can't link because can't determine link dir.
define env NVM_LINK to specify the link dir.</>`);
    common.exit(1);
  }

  // Resolve special keywords like "lts" and "latest" to actual versions
  let resolvedVer = ver;
  const lver = ver ? ver.toLowerCase() : "";

  if (lver === "lts" || lver === "vlts" || lver === "latest" || lver === "vlatest") {
    // Get installed versions
    const installedVersions = await common.findLocalVersions();

    if (installedVersions.length === 0) {
      common.log(ck`<red>No Node.js versions installed yet</>`);
      common.exit(1);
    }

    if (lver === "lts" || lver === "vlts") {
      // Find the latest LTS version among installed versions
      // We need to fetch remote versions to know which ones are LTS
      try {
        const remoteVersions = await common.getRemoteFromJson(null, true, true);
        // Filter installed versions that are also LTS versions
        const installedLtsVersions = installedVersions.filter(v => remoteVersions.includes(v));

        if (installedLtsVersions.length === 0) {
          common.log(ck`<red>No LTS versions installed. Available LTS versions can be found with: nvm ls-remote</>`);
          common.log(`Installed versions: ${installedVersions.join(" ")}`);
          common.exit(1);
        }

        // Get the latest LTS version
        resolvedVer = installedLtsVersions[installedLtsVersions.length - 1];
        common.log(ck`<green>Linking to latest installed LTS version: ${resolvedVer}</>`);
      } catch (err) {
        common.log(ck`<red>Unable to fetch remote versions to determine LTS status</>`);
        common.log(ck`<yellow>Please specify a specific version instead</>`);
        common.exit(1);
      }
    } else {
      // "latest" - just use the latest installed version
      resolvedVer = installedVersions[installedVersions.length - 1];
      common.log(ck`<green>Linking to latest installed version: ${resolvedVer}</>`);
    }
  }

  const { version, nodeDir } = await common.findNodeVersion(resolvedVer);

  try {
    if (await common._exists(link)) {
      await opfs.unlink(link);
    } else {
      const baseDir = path.dirname(link);
      if (!(await common._exists(baseDir))) {
        await opfs.$.mkdirp(baseDir);
      }
    }

    const nodeBinDir = common.getNodeBinDir(nodeDir);
    await opfs.symlink(nodeBinDir, link, "junction");

    process.env.NVM_LINK_VERSION = version;

    if (!process.env.NVM_USE) {
      await common.setNvmLinkPath();
    }
    await common.createEnvironmentTmp();
  } catch (err) {
    common.log(ck`<red>switch to version ${version} failed</>`, err);
    common.exit(1);
  }
};
