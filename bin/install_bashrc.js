"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const homeDir = os.homedir();

const nvmHome = process.env.NVM_HOME || `${homeDir}/nvm`;
const nvmLink = process.env.NVM_LINK || `${nvmHome}/nodejs/bin`;

const homeAlias = process.env.HOME ? "${HOME}" : "~";

const varNvmHome = nvmHome.replace(homeDir, homeAlias);
const varNvmLink = nvmLink.replace(homeDir, homeAlias);

const shellName = process.argv[3] || "bash";

const begin = `# NVM ${shellName} initialize BEGIN - do not modify #`;
const end = `# NVM ${shellName} initialize END - do not modify #`;
const mirror = process.env.NVM_NODEJS_ORG_MIRROR;
const mirrorEnv = mirror && `  export NVM_NODEJS_ORG_MIRROR="${mirror}"`;

const commands = [
  begin,
  `export NVM_HOME="${varNvmHome}"`,
  `NVM_SH="\$\{NVM_HOME}/bin/nvm.sh"`,
  `if [ -s "\$\{NVM_SH}" ]; then`,
  `  export NVM_LINK="${varNvmLink}"`,
  mirrorEnv,
  `  source "\$\{NVM_SH}"`,
  `  alias nvx="\$\{NVM_HOME}/bin/nvx"`,
  `else`,
  `  unset NVM_HOME`,
  `  NVM_ERROR="\$\{NVM_SH} is not valid"`,
  `fi`,
  `unset NVM_SH`,
  end
].filter(x => x);

const profileFile = process.argv[2] || path.join(homeDir, ".bash_profile");
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
