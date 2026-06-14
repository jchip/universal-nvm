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

// Atomically replace a file's contents: write a sibling temp file, then
// rename(2) it over the target. rename is atomic on POSIX, so an interrupted or
// failed write can never leave the user's profile half-written -- the original
// stays intact until the swap. Resolve a symlinked profile first (dotfile
// managers symlink .bashrc/.zshrc to a managed source) so the link is preserved
// and we write through to its real target, and carry over the existing file's
// permission bits -- both matching the previous in-place fs.writeFileSync.
function writeFileAtomicSync(file, data) {
  let target = file;
  let mode; // undefined => let umask pick the default for a brand-new file
  if (fs.existsSync(file)) {
    target = fs.realpathSync(file);
    mode = fs.statSync(target).mode & 0o777;
  }

  const unique = `${process.pid}.${Math.random().toString(36).slice(2)}`;
  const tmpPath = `${target}.${unique}.tmp`;
  try {
    fs.writeFileSync(tmpPath, data, { flag: "wx" });
    if (mode !== undefined) {
      fs.chmodSync(tmpPath, mode);
    }
    fs.renameSync(tmpPath, target);
  } catch (err) {
    try {
      fs.unlinkSync(tmpPath);
    } catch (cleanupErr) {
      // temp file may not have been created; nothing to clean up
    }
    throw err;
  }
}

function updateShellProfile(profileFile) {
  const profile = fs.existsSync(profileFile) ? fs.readFileSync(profileFile, "utf8").split("\n") : [];

  // Strip every existing nvm block (begin..end inclusive). A profile may hold
  // more than one - left by an older version or hand-editing - and removing only
  // the first (the previous single-indexOf behavior) silently duplicated the rest.
  const kept = [];
  let insertAt = -1; // re-insert the fresh block where the first old block began

  for (let i = 0; i < profile.length; i++) {
    if (profile[i] !== begin) {
      kept.push(profile[i]);
      continue;
    }

    // Found a begin marker; locate its matching end at or after it.
    const endIx = profile.indexOf(end, i + 1);
    if (endIx < 0) {
      // begin marker with no following end: the block's extent is ambiguous.
      // Abort rather than duplicate the old block or guess and delete user
      // content; ask the user to clean it up.
      console.error(
        `WARNING:
nvm install found the begin marker but not the end marker in your ${profileFile}
Skipping update to avoid corrupting the file. Please remove the stale nvm block
(from the begin marker down to where it should end) and re-run install:
${begin}
${end}
`
      );
      return false;
    }

    if (insertAt < 0) {
      insertAt = kept.length;
    }
    i = endIx; // skip the block; the loop's i++ steps past the end marker
  }

  if (insertAt < 0) {
    insertAt = kept.length; // no existing block: append at the end
  }

  let updateProfile = kept.slice(0, insertAt).concat(commands, kept.slice(insertAt));
  // remove last line if it's empty
  const lastIx = updateProfile.length - 1;
  if (lastIx >= 0 && updateProfile[lastIx].trim().length === 0) {
    updateProfile = updateProfile.slice(0, lastIx);
  }

  writeFileAtomicSync(profileFile, updateProfile.concat("").join("\n"));
  return true;
}

// Export for reuse
if (typeof module !== "undefined" && module.exports) {
  module.exports = { updateShellProfile, nvmHome, shellName };
}

// Run as script if called directly
if (require.main === module) {
  const profileFile = process.argv[2] || path.join(homeDir, ".bash_profile");
  // Exit non-zero when the update is skipped so callers (e.g. `nvx
  // --install-to-user`) can detect it and not report a false success.
  process.exit(updateShellProfile(profileFile) ? 0 : 1);
}
