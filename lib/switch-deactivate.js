"use strict";

/* eslint-disable max-statements */

const fs = require("fs");
const use = require("./use");
const common = require("./common");
const ck = require("chalker");

// Does the path exist in its own right (link, file or dir)? Unlike
// common._exists (fs.access, which follows symlinks and so reports a dangling
// link as missing), lstat inspects the link itself -- so a broken
// default-version symlink is still detected and gets removed.
async function lexists(pathName) {
  try {
    await fs.promises.lstat(pathName);
    return true;
  } catch (err) {
    if (err.code === "ENOENT") {
      return false;
    }
    throw err;
  }
}

module.exports = async function() {
  const link = common.getNvmLinkDir();

  try {
    if (await lexists(link)) {
      await fs.promises.unlink(link);
    }

    delete process.env.NVM_LINK_VERSION;
    process.env.NVM_UNLINK_VERSION = "true";

    if (process.env.NVM_USE) {
      // use will create enviroment tmp file
      await use(process.env.NVM_USE);
    } else {
      await common.resetNvmPaths();
      await common.createEnvironmentTmp();
    }
  } catch (err) {
    common.log(ck`<red>switch-deactivate failed</>`, err);
    common.exit(1);
  }
};
