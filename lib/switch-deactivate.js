"use strict";

/* eslint-disable max-statements */

const fs = require("fs");
const use = require("./use");
const common = require("./common");
const ck = require("chalker");

module.exports = async function() {
  const link = common.getNvmLinkDir();

  try {
    if (await common.lexists(link)) {
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
