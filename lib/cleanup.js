"use strict";

const fs = require("fs");
const common = require("./common");

module.exports = async function() {
  try {
    await fs.promises.rm(common.getNvmCacheDir(), { recursive: true, force: true });
    common.log("stale local caches removed");
  } catch (err) {
    common.log("cleanup failed", err);
  }
};
