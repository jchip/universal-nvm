"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const homeDir = os.homedir();

const nvmHome = process.env.NVM_HOME || `${homeDir}/.unvm`;

// Use HOME variable (works on Unix and Git Bash on Windows)
const homeAlias = "${HOME}";

// Normalize paths to use forward slashes for comparison
const normalizeHomePath = (p) => p.replace(/\\/g, "/");
const normalizedHomeDir = normalizeHomePath(homeDir);
const normalizedNvmHome = normalizeHomePath(nvmHome);

const varNvmHome = normalizedNvmHome.replace(normalizedHomeDir, homeAlias);

const shellName = process.argv[3] || "bash";

const begin = `# NVM ${shellName} initialize BEGIN - do not modify #`;
const end = `# NVM ${shellName} initialize END - do not modify #`;
const mirror = process.env.NVM_NODEJS_ORG_MIRROR;
const mirrorEnv = mirror && `  export NVM_NODEJS_ORG_MIRROR="${mirror}"`;

const commands = [
  begin,
  `# Only initialize if not already done`,
  `if ! type _unvm_init >/dev/null 2>&1; then`,
  `  export NVM_HOME="${varNvmHome}"`,
  `  export PATH="\$\{NVM_HOME}/bin:\$PATH"`,
  `  UNVM_SH="\$\{NVM_HOME}/bin/unvm.sh"`,
  `  if [ -s "\$\{UNVM_SH}" ]; then`,
  `    export NVM_LINK="\$\{NVM_HOME}/nodejs/bin"`,
  mirrorEnv,
  `    source "\$\{UNVM_SH}"`,
  `    alias nvx="\$\{NVM_HOME}/bin/nvx"`,
  `  else`,
  `    unset NVM_HOME`,
  `    UNVM_ERROR="\$\{UNVM_SH} is not valid"`,
  `  fi`,
  `  unset UNVM_SH`,
  `fi`,
  end
].filter(x => x);

function updateShellProfile(profileFile) {
  let profile = fs.existsSync(profileFile) ? fs.readFileSync(profileFile, "utf8").split("\n") : [];

  const beginIx = profile.indexOf(begin);

  let firstPart = profile;
  let secondPart = [];

  if (beginIx >= 0) {
    firstPart = profile.slice(0, beginIx);
    const endIx = profile.indexOf(end);
    if (endIx < beginIx) {
      secondPart = profile.slice(beginIx + 1);
      console.log(
        `WARNING:
nvm install found begin marker but not end marker in your ${profileFile}
please check these markers in the file and clean it up:
${begin}
${end}
`
      );
    } else {
      secondPart = profile.slice(endIx + 1);
    }
  }

  let updateProfile = firstPart.concat(commands, secondPart);
  // remove last line if it's empty
  const lastIx = updateProfile.length - 1;
  if (updateProfile[lastIx].trim().length === 0) {
    updateProfile = updateProfile.slice(0, lastIx);
  }

  fs.writeFileSync(profileFile, updateProfile.concat("").join("\n"));
}

// Export for reuse
if (typeof module !== "undefined" && module.exports) {
  module.exports = { updateShellProfile, nvmHome, shellName };
}

// Run as script if called directly
if (require.main === module) {
  const profileFile = process.argv[2] || path.join(homeDir, ".bash_profile");
  updateShellProfile(profileFile);
}
