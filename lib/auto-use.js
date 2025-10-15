"use strict";

const ck = require("chalker");
const common = require("./common");

/**
 * Check if we've already shown this error in the current shell session
 * Uses environment variable to persist across nvm invocations
 * Uses semicolon as delimiter since error keys contain colons (e.g., ".nvmrc:16.0.0")
 */
function hasShownError(errorKey) {
  const shown = process.env.NVM_AUTO_USE_SHOWN_ERRORS || "";
  return shown.split(";").includes(errorKey);
}

/**
 * Mark an error as shown in the current shell session
 * Updates environment variable to persist across nvm invocations
 * Uses semicolon as delimiter since error keys contain colons (e.g., ".nvmrc:16.0.0")
 */
function markErrorAsShown(errorKey) {
  const shown = process.env.NVM_AUTO_USE_SHOWN_ERRORS || "";
  const errors = shown ? shown.split(";") : [];
  if (!errors.includes(errorKey)) {
    errors.push(errorKey);
    process.env.NVM_AUTO_USE_SHOWN_ERRORS = errors.join(";");
  }
}

/**
 * Automatically switch to Node.js version specified in current directory
 * @param {Object} options - Options for auto-use
 * @param {boolean} options.silent - If true, suppress "no version file found" message (but still show switch messages)
 * @param {boolean} options.verbose - If true, show which version file was found
 * @param {string} options.prefix - Message prefix ("auto-use from" or "from")
 * @returns {Object|null} - Returns {version, switched} or null if no action taken
 */
async function autoUse(options = {}) {
  const { silent = true, verbose = false, prefix = "auto-use from" } = options;

  try {
    // Check if there's a version file in the current directory
    // When silent=true, suppress "no version file found" message
    const versionInfo = await common.getNodeVersionFromFile(silent);

    if (!versionInfo) {
      // No version file found, nothing to do
      return null;
    }

    const { version: ver, source, range } = versionInfo;
    const cleanVer = ver.replace(/^v/, "").trim();

    // Try to find and switch to the version
    let version, nodeDir;
    try {
      const result = await common.findNodeVersion(cleanVer);
      version = result.version;
      nodeDir = result.nodeDir;
    } catch (err) {
      // Version not installed - show error once per shell session (even in silent mode)
      // This helps users know when they need to install a version
      // Uses environment variable to persist across nvm invocations
      const errorKey = `${source}:${cleanVer}`;
      if (!hasShownError(errorKey)) {
        common.log(ck`<yellow>Version ${cleanVer} from ${source} not installed</>`);
        markErrorAsShown(errorKey);
        // Write environment temp file to persist the error tracking to shell session
        await common.createEnvironmentTmp();
      }
      return null;
    }

    // Check if we're already using this version
    const currentVersion = process.env.NVM_USE || (await common.findLinkVersion());
    if (currentVersion === version) {
      // Already using this version, no need to switch (silent - no message)
      return { version, switched: false };
    }

    // Switch to the version
    await common.resetNvmPaths();
    common.setNvmUsePath(nodeDir);
    process.env.NVM_USE = version;

    // Write environment temp file with all necessary exports
    // This includes NVM_AUTO_USE_SHOWN_ERRORS to persist across nvm invocations
    await common.createEnvironmentTmp();

    // Always show version switch message (even when silent=true)
    // Silent only suppresses "not found" messages, not actual switches
    const action = verbose ? "Switched to" : "Using";
    const rangeInfo = range ? `: ${range}` : "";
    common.log(ck`<green>${action} node ${version}</> <dim>(${prefix} ${source}${rangeInfo})</>`);

    return { version, switched: true, source };
  } catch (err) {
    if (!silent) {
      common.log(ck`<yellow>Auto-use failed: ${err.message}</>`);
    }
    return null;
  }
}

module.exports = autoUse;

// Export for testing - allows clearing the error tracking between tests
module.exports._clearShownErrors = () => {
  delete process.env.NVM_AUTO_USE_SHOWN_ERRORS;
};
