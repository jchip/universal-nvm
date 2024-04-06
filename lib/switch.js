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

  const { version, nodeDir } = await common.findNodeVersion(ver);

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
