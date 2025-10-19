"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const ck = require("chalker");
const common = require("./common");

const homeDir = os.homedir();
const nvmHome = process.env.NVM_HOME || path.join(homeDir, "nvm");

// Markers for our auto-use setup
const BEGIN_MARKER = "# NVM auto-use BEGIN - do not modify #";
const END_MARKER = "# NVM auto-use END - do not modify #";

/**
 * Detect current shell type
 * Note: nvm.sh detects bash vs zsh and passes it via --shell argument
 */
function detectShellType() {
  // Shell type is passed via --shell argument from nvm.sh/nvm.ps1/nvm.cmd
  const shellType = common.getShellType();

  // shellType will be:
  // - 'bash' or 'zsh' when called from nvm.sh (Unix/Git Bash)
  // - 'powershell' or 'cmd' when called from nvm.ps1/nvm.cmd (Windows)
  // - null when called directly (e.g., during tests)

  if (shellType) {
    return shellType;
  }

  // Fallback detection for when called directly without --shell argument
  if (common.isWindows()) {
    return "powershell";
  }

  // Detect bash vs zsh from environment
  if (process.env.ZSH_VERSION || (process.env.SHELL && process.env.SHELL.includes("zsh"))) {
    return "zsh";
  }

  return "bash";
}

/**
 * Get shell profile file path(s) based on current shell
 * Returns an array of paths to update
 */
function getShellProfilePaths() {
  const shellType = detectShellType();

  if (shellType === "zsh") {
    // For zsh, update both .zshenv and .zshrc
    return [
      path.join(homeDir, ".zshenv"),
      path.join(homeDir, ".zshrc")
    ];
  } else if (shellType === "bash") {
    // Bash - prefer .bashrc on Linux, .bash_profile on macOS
    const platform = os.platform();
    if (platform === "darwin") {
      const bashProfile = path.join(homeDir, ".bash_profile");
      const bashrc = path.join(homeDir, ".bashrc");
      // Use .bash_profile if it exists, otherwise .bashrc
      if (fs.existsSync(bashProfile)) {
        return [bashProfile];
      }
      return [bashrc];
    } else {
      return [path.join(homeDir, ".bashrc")];
    }
  }

  // Default to .bashrc
  return [path.join(homeDir, ".bashrc")];
}

/**
 * Get shell profile file path based on current shell (for backward compatibility)
 */
function getShellProfilePath() {
  return getShellProfilePaths()[0];
}

/**
 * Get the auto-use setup lines for bash/zsh
 * @param {boolean} useCdWrapper - If true, use cd wrapper mode instead of prompt-based
 */
function getAutoUseSetupLines(useCdWrapper = false) {
  // Use NVM_HOME variable for portability
  const nvmHomeVar = "${NVM_HOME}";

  const enableCommand = useCdWrapper ? `nvm_enable_auto_use --cd` : `nvm_enable_auto_use`;

  return [
    BEGIN_MARKER,
    `source "${nvmHomeVar}/bin/nvm-auto-use.sh"`,
    enableCommand,
    END_MARKER
  ];
}

/**
 * Check if auto-use is already enabled in profile
 */
function isAutoUseEnabled(profilePath) {
  if (!fs.existsSync(profilePath)) {
    return false;
  }

  const content = fs.readFileSync(profilePath, "utf8");
  // Check for both old standalone marker and new inline comment
  return content.includes(BEGIN_MARKER) || content.includes("# NVM auto-use");
}

/**
 * Enable auto-use in a single profile file
 */
function enableAutoUseInProfile(profilePath, useCdWrapper) {
  const profileName = path.basename(profilePath);

  // Read existing profile or create empty
  let profile = fs.existsSync(profilePath)
    ? fs.readFileSync(profilePath, "utf8").split("\n")
    : [];

  // Find the NVM initialization block
  const shellType = detectShellType();
  const nvmInitBegin = `# NVM ${shellType} initialize BEGIN - do not modify #`;
  const nvmInitEnd = `# NVM ${shellType} initialize END - do not modify #`;

  const beginIndex = profile.indexOf(nvmInitBegin);
  const endIndex = profile.indexOf(nvmInitEnd);

  if (beginIndex === -1 || endIndex === -1) {
    common.log(ck`<yellow>Warning: NVM initialization block not found in ${profileName}</>`);
    common.log(ck`Skipping ${profileName}. Run the NVM installer to set it up first.`);
    return false;
  }

  // Find the line with alias nvx (insert auto-use after this)
  let insertIndex = -1;
  for (let i = beginIndex; i < endIndex; i++) {
    if (profile[i].includes('alias nvx=')) {
      insertIndex = i + 1;
      break;
    }
  }

  if (insertIndex === -1) {
    common.log(ck`<yellow>Warning: Could not find insertion point in ${profileName}</>`);
    return false;
  }

  // Use NVM_HOME variable for portability
  const nvmHomeVar = "${NVM_HOME}";
  const enableCommand = useCdWrapper ? `nvm_enable_auto_use --cd` : `nvm_enable_auto_use`;

  // Insert auto-use lines at the correct position (inside the NVM init block)
  const autoUseLines = [
    `    # NVM auto-use`,
    `    source "${nvmHomeVar}/bin/nvm-auto-use.sh"`,
    `    ${enableCommand}`
  ];

  const updatedProfile = [
    ...profile.slice(0, insertIndex),
    ...autoUseLines,
    ...profile.slice(insertIndex)
  ];

  // Write back
  fs.writeFileSync(profilePath, updatedProfile.join("\n"));
  return true;
}

/**
 * Enable auto-use by adding setup to shell profile(s)
 * @param {boolean} useCdWrapper - If true, use cd wrapper mode instead of prompt-based
 */
function enableAutoUseBashZsh(useCdWrapper = false) {
  const profilePaths = getShellProfilePaths();

  // Check if already enabled in any profile
  const alreadyEnabled = profilePaths.some(p => isAutoUseEnabled(p));
  if (alreadyEnabled) {
    common.log(ck`<yellow>Auto-use is already enabled</>`);
    return;
  }

  const updatedFiles = [];

  // Update each profile file
  for (const profilePath of profilePaths) {
    if (enableAutoUseInProfile(profilePath, useCdWrapper)) {
      updatedFiles.push(profilePath);
    }
  }

  if (updatedFiles.length === 0) {
    common.log(ck`<red>Failed to enable auto-use in any profile file</>`);
    return;
  }

  const mode = useCdWrapper ? " (cd wrapper mode)" : "";
  common.log(ck`<green>Auto-use enabled${mode}!</>`);
  common.log(ck`Updated files:`);
  updatedFiles.forEach(f => common.log(ck`  <white>${f}</>`));
  common.log("");
  common.log(ck`To activate in your current shell, run:`);
  common.log(ck`  <cyan>source ${updatedFiles[0]}</>`);
  common.log(ck`Or restart your terminal.`);
}

/**
 * Disable auto-use in a single profile file
 */
function disableAutoUseInProfile(profilePath) {
  const profileName = path.basename(profilePath);

  if (!fs.existsSync(profilePath)) {
    return false;
  }

  // Read profile
  const profile = fs.readFileSync(profilePath, "utf8").split("\n");

  // Check for old standalone format first
  const beginIndex = profile.indexOf(BEGIN_MARKER);
  const endIndex = profile.indexOf(END_MARKER);

  if (beginIndex !== -1 && endIndex !== -1 && endIndex > beginIndex) {
    // Remove old standalone format
    let firstPart = profile.slice(0, beginIndex);
    let secondPart = profile.slice(endIndex + 1);

    // Remove trailing empty line from first part if exists
    if (firstPart.length > 0 && firstPart[firstPart.length - 1].trim() === "") {
      firstPart = firstPart.slice(0, -1);
    }

    // Remove leading empty line from second part if exists
    if (secondPart.length > 0 && secondPart[0].trim() === "") {
      secondPart = secondPart.slice(1);
    }

    const updatedProfile = firstPart.concat(secondPart);

    // Write back
    fs.writeFileSync(profilePath, updatedProfile.concat("").join("\n"));
    return true;
  }

  // Handle new inline format (inside NVM initialization block)
  const autoUseCommentIndex = profile.findIndex(line => line.trim() === "# NVM auto-use");

  if (autoUseCommentIndex === -1) {
    return false;
  }

  // Remove the 3 auto-use lines: comment, source, and enable command
  const updatedProfile = [
    ...profile.slice(0, autoUseCommentIndex),
    ...profile.slice(autoUseCommentIndex + 3)
  ];

  // Write back
  fs.writeFileSync(profilePath, updatedProfile.join("\n"));
  return true;
}

/**
 * Disable auto-use by removing setup from shell profile(s)
 */
function disableAutoUseBashZsh() {
  const profilePaths = getShellProfilePaths();

  // Check if enabled in any profile
  const anyEnabled = profilePaths.some(p => isAutoUseEnabled(p));
  if (!anyEnabled) {
    common.log(ck`<yellow>Auto-use is not enabled</>`);
    return;
  }

  const updatedFiles = [];

  // Disable in each profile file
  for (const profilePath of profilePaths) {
    if (disableAutoUseInProfile(profilePath)) {
      updatedFiles.push(profilePath);
    }
  }

  if (updatedFiles.length === 0) {
    common.log(ck`<yellow>Could not find auto-use setup to remove</>`);
    return;
  }

  common.log(ck`<green>Auto-use disabled!</>`);
  common.log(ck`Updated files:`);
  updatedFiles.forEach(f => common.log(ck`  <white>${f}</>`));
  common.log("");
  common.log(ck`To deactivate in your current shell, run:`);
  common.log(ck`  <cyan>nvm_disable_auto_use</>`);
  common.log(ck`Or restart your terminal.`);
}

/**
 * Get PowerShell profile path (handles both PowerShell 5 and 7, and OneDrive)
 */
function getPowerShellProfilePath() {
  // Use NVM_PSPROFILE environment variable if set (passed from nvm.ps1)
  if (process.env.NVM_PSPROFILE) {
    return process.env.NVM_PSPROFILE;
  }

  // Check for PowerShell 7+ profile first
  const ps7Profile = path.join(homeDir, "Documents", "PowerShell", "Microsoft.PowerShell_profile.ps1");
  if (fs.existsSync(ps7Profile) || fs.existsSync(path.dirname(ps7Profile))) {
    return ps7Profile;
  }

  // Fall back to PowerShell 5 profile
  return path.join(homeDir, "Documents", "WindowsPowerShell", "Microsoft.PowerShell_profile.ps1");
}

/**
 * Enable auto-use for PowerShell
 * @param {boolean} useCdWrapper - If true, use cd wrapper mode instead of prompt-based
 */
function enableAutoUsePowerShell(useCdWrapper = false) {
  const profilePath = getPowerShellProfilePath();

  // Check if already enabled
  if (isAutoUseEnabled(profilePath)) {
    common.log(ck`<yellow>Auto-use is already enabled in PowerShell profile</>`);
    return;
  }

  // Read existing profile or create empty
  let profile = fs.existsSync(profilePath)
    ? fs.readFileSync(profilePath, "utf8").replace(/\r\n/g, "\n").split("\n")
    : [];

  // Remove last empty line if exists
  if (profile.length > 0 && profile[profile.length - 1].trim() === "") {
    profile = profile.slice(0, -1);
  }

  // Add setup lines
  const nvmHomeVar = `$Env:NVM_HOME`;
  const enableCommand = useCdWrapper ? `Enable-NvmAutoUseCdWrapper -Quiet` : `Enable-NvmAutoUse -Quiet`;
  const setupLines = [
    BEGIN_MARKER,
    `. "${nvmHomeVar}\\bin\\nvm-auto-use.ps1"`,
    enableCommand,
    END_MARKER
  ];

  const updatedProfile = profile.concat("", setupLines, "");

  // Ensure directory exists
  const profileDir = path.dirname(profilePath);
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }

  // Write back
  fs.writeFileSync(profilePath, updatedProfile.join("\r\n"));

  const mode = useCdWrapper ? " (cd wrapper mode)" : "";
  common.log(ck`<green>Auto-use enabled${mode}!</>`);
  common.log(ck`Added to: <white>${profilePath}</>`);
  common.log("");
  common.log(ck`To activate in your current shell, run:`);
  common.log(ck`  <cyan>. $PROFILE</>`);
  common.log(ck`Or restart PowerShell.`);
}

/**
 * Disable auto-use for PowerShell
 */
function disableAutoUsePowerShell() {
  const profilePath = getPowerShellProfilePath();

  // Check if not enabled
  if (!isAutoUseEnabled(profilePath)) {
    common.log(ck`<yellow>Auto-use is not enabled in PowerShell profile</>`);
    return;
  }

  // Read profile (normalize line endings for Windows)
  const profile = fs.readFileSync(profilePath, "utf8").replace(/\r\n/g, "\n").split("\n");

  // Find and remove setup lines
  const beginIndex = profile.indexOf(BEGIN_MARKER);
  const endIndex = profile.indexOf(END_MARKER);

  if (beginIndex === -1 || endIndex === -1 || endIndex < beginIndex) {
    common.log(ck`<yellow>Warning: Found markers but they're malformed in PowerShell profile</>`);
    common.log(ck`Please manually remove these lines:`);
    common.log(ck`  <dim>${BEGIN_MARKER}</>`);
    common.log(ck`  <dim>${END_MARKER}</>`);
    return;
  }

  // Remove the setup block
  let firstPart = profile.slice(0, beginIndex);
  let secondPart = profile.slice(endIndex + 1);

  // Clean up empty lines
  if (firstPart.length > 0 && firstPart[firstPart.length - 1].trim() === "") {
    firstPart = firstPart.slice(0, -1);
  }
  if (secondPart.length > 0 && secondPart[0].trim() === "") {
    secondPart = secondPart.slice(1);
  }

  const updatedProfile = firstPart.concat(secondPart);

  // Write back
  fs.writeFileSync(profilePath, updatedProfile.concat("").join("\r\n"));

  common.log(ck`<green>Auto-use disabled!</>`);
  common.log(ck`Removed from: <white>${profilePath}</>`);
  common.log("");
  common.log(ck`To deactivate in your current shell, run:`);
  common.log(ck`  <cyan>Disable-NvmAutoUse</>`);
  common.log(ck`Or restart PowerShell.`);
}

/**
 * Enable auto-use (detects platform/shell)
 * @param {boolean} useCdWrapper - If true, use cd wrapper mode instead of prompt-based
 */
function enableAutoUse(useCdWrapper = false) {
  detectShellType(); // Ensure shell type is detected

  if (common.isPosix()) {
    enableAutoUseBashZsh(useCdWrapper);
  } else if (common.isWindows()) {
    enableAutoUsePowerShell(useCdWrapper);
  } else {
    // Fallback to bash/zsh for unknown Unix shells
    enableAutoUseBashZsh(useCdWrapper);
  }
}

/**
 * Disable auto-use (detects platform/shell)
 */
function disableAutoUse() {
  detectShellType(); // Ensure shell type is detected

  if (common.isPosix()) {
    disableAutoUseBashZsh();
  } else if (common.isWindows()) {
    disableAutoUsePowerShell();
  } else {
    // Fallback to bash/zsh for unknown Unix shells
    disableAutoUseBashZsh();
  }
}

module.exports = {
  enableAutoUse,
  disableAutoUse,
  isAutoUseEnabled,
  getShellProfilePath
};
