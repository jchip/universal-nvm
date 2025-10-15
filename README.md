# Universal NVM (@jchip/nvm)

A universal node.js version manager for Windows (no admin) and Unix.

- Install is simple with a PowerShell script on Windows, or a bash script on Unix.

- **No admin required on Windows to install or use.**

- A linked system wide version that can be changed any time.

- Change to any version independently in a terminal any time.

## Table Of Contents

- [Universal NVM (@jchip/nvm)](#universal-nvm-jchipnvm)
  - [Table Of Contents](#table-of-contents)
  - [Installing Universal NVM on Windows using PowerShell](#installing-universal-nvm-on-windows-using-powershell)
    - [Installing from github.com](#installing-from-githubcom)
    - [Installing from unpkg.com](#installing-from-unpkgcom)
    - [Installing from jsdelivr.net](#installing-from-jsdelivrnet)
    - [Windows 7 Updates](#windows-7-updates)
    - [Troubleshooting](#troubleshooting)
      - [Running scripts disabled](#running-scripts-disabled)
      - [No PowerShell - Manual Install](#no-powershell---manual-install)
  - [Installing Universal NVM on Unix](#installing-universal-nvm-on-unix)
    - [Installing from github.com](#installing-from-githubcom-1)
    - [Installing from unpkg.com](#installing-from-unpkgcom-1)
    - [Installing from jsdelivr.net](#installing-from-jsdelivrnet-1)
    - [Shell Initialization on Unix](#shell-initialization-on-unix)
      - [Zsh (macOS default)](#zsh-macos-default)
      - [Bash](#bash)
  - [Usage](#usage)
    - [Environments](#environments)
  - [nvx - Execute with local node_modules](#nvx---execute-with-local-node_modules)
    - [Basic Usage](#basic-usage)
    - [Show Help](#show-help)
    - [Installing to PATH (macOS/Linux only)](#installing-to-path-macoslinux-only)
      - [Install to User PATH (recommended)](#install-to-user-path-recommended)
      - [Install to System PATH (all users)](#install-to-system-path-all-users)
      - [How it Works](#how-it-works)
  - [Contributing and Release](#contributing-and-release)
    - [Development](#development)
    - [Release Process](#release-process)
  - [License](#license)

## Installing Universal NVM on Windows using PowerShell

**_You don't need admin rights to install or use_**, only the permission to execute PowerShell scripts.

Tested on Windows 10, 8.1, and 7. Windows 7 requires PowerShell updates, see [update instructions](#windows-7-updates).

To install, start a Windows PowerShell and copy and paste one of the scripts below into the shell terminal and press enter.

- This will install nvm and current LTS Node.js (v12.13.0) to directory `nvm` under your home specified by `$Env:USERPROFILE`.

- If you want to install this under another directory, then set it with the param `-nvmhome`.

- If you don't set it, then `$Env:NVM_HOME` will be checked, and if non-existent, then a Directory Browser dialog will be opened for you to create and choose a directory.

[Video Demo of upgrading Windows 7 to PowerShell 5.1 and then installing this](https://youtu.be/BFYcXLS5R_4)

You can retrieve the install script from multiple sources. Listed below are three options for you to choose from in case one of them is down.

### Installing from github.com

Retrieve install script from [github.com](https://www.github.com/jchip/nvm) directly:

```powershell
cd $Env:USERPROFILE;
Invoke-WebRequest https://raw.githubusercontent.com/jchip/nvm/v1.8.4/install.ps1 -OutFile install.ps1;
.\install.ps1 -nvmhome $Env:USERPROFILE\nvm;
del install.ps1
```

### Installing from unpkg.com

Retrieve install script from [unpkg.com](https://unpkg.com):

```powershell
cd $Env:USERPROFILE;
Invoke-WebRequest https://unpkg.com/@jchip/nvm@1.8.4/install.ps1 -OutFile install.ps1;
.\install.ps1 -nvmhome $Env:USERPROFILE\nvm;
del install.ps1
```

### Installing from jsdelivr.net

Retrieve install script from [jsdelivr.net](https://www.jsdelivr.com/):

```powershell
cd $Env:USERPROFILE;
Invoke-WebRequest https://cdn.jsdelivr.net/npm/@jchip/nvm@1.8.4/install.ps1 -OutFile install.ps1;
.\install.ps1 -nvmhome $Env:USERPROFILE\nvm;
del install.ps1
```

### Windows 7 Updates

PowerShell version 4+ is required.

For Windows 7, you can update it to version 5.1 with the following instructions:

1. Go to <https://www.microsoft.com/en-us/download/details.aspx?id=54616>
2. Click Red Download button
3. Download `Win7AndW2K8R2-KB3191566-x64.zip` or `Win7-KB3191566-x86.zip` for 32-bit
4. Unzip the file
5. Run the package `Win7AndW2K8R2-KB3191566-x64.msu` or `Win7-KB3191566-x86.msu` for 32-bit

After it's completed and rebooted, launch PowerShell and type `$PSVersionTable` to check.

> PSVersion should be something like `5.1.#####.####`

[Video Demo of upgrading Windows 7 to PowerShell 5.1 and then installing this](https://youtu.be/BFYcXLS5R_4)

### Troubleshooting

#### Running scripts disabled

If you get the error:

> install.ps1 cannot be loaded because running scripts is disabled on this system.

Then you need to set execution policy for PowerShell to `RemoteSigned` with the command:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

See this [StackOverflow question](https://stackoverflow.com/questions/4037939/powershell-says-execution-of-scripts-is-disabled-on-this-system) for details.

You need to keep this policy if you want to use `nvm` in PowerShell to switch node.js versions.

#### No PowerShell - Manual Install

If for some reason you absolutely can't have PowerShell or permission to install from it, then you can try to manually install following these steps:

1. Download the package zip file from https://github.com/jchip/nvm/archive/v1.8.4/.zip
   1. Extract this file to your home directory. You will get a new directory `nvm-1.8.4`.
   2. Rename it to `nvm`, for example: `C:\Users\<username>\nvm`
2. Download the zipfile https://nodejs.org/dist/v20.12.1/node-v20.12.1-win-x64.zip
   1. Extract this file to `C:\Users\<username>\nvm`. You will get a new directory `node-v20.12.1-win-x64`
   2. Move `node.exe` from that directory into `C:\Users\<username>\nvm`
   3. (optional) You can delete the directory after if you want.
3. Open `RegEdit.exe`, in `HKEY_CURRENT_USER/Environment`
   1. Add the following entries
      1. `NVM_HOME` -> `C:\Users\<username>\nvm`
      2. `NVM_LINK` -> `C:\Users\<username>\nvm\nodejs\bin`
   2. Append the following to the entry `Path`
      1. `;C:\Users\<username>\nvm\bin;C:\users\<username>\nvm\nodejs\bin`
4. Open Command Prompt, and run `nvm install lts`, note the version installed, and then `nvm link <version>`.

**_Make sure to replace `<username>` above with your actual user name_**.

### Using Git Bash on Windows

If you want to use Universal NVM with Git Bash after installing on Windows via PowerShell:

1. First install nvm using PowerShell (see instructions above)
2. Open Git Bash
3. Run the setup script:
   ```bash
   $NVM_HOME/bin/nvm-setup.sh
   ```
4. Restart Git Bash or run:
   ```bash
   source ~/.bashrc
   ```

Now you can use `nvm` commands in Git Bash just like on Unix systems.

## Installing Universal NVM on Unix

Because this is implemented in node.js, it happens to work on Unix also. It just need a different install script using bash.

To retrieve and run the install script, provided below are three options for you to choose from in case one of them is down.

Please pick one and then copy and paste it into a bash terminal to run.

### Installing from github.com

Retrieve the install script from [github.com](https://www.github.com/jchip/nvm):

Using cURL and the install script:

```bash
export NVM_HOME=~/nvm; curl -o- https://raw.githubusercontent.com/jchip/nvm/v1.8.4/install.sh | bash
```

or wget:

```bash
export NVM_HOME=~/nvm; wget -qO- https://raw.githubusercontent.com/jchip/nvm/v1.8.4/install.sh | bash
```

### Installing from unpkg.com

Retrieve the install script from [unpkg.com](https://unpkg.com):

Using cURL and the install script:

```bash
export NVM_HOME=~/nvm; curl -o- https://unpkg.com/@jchip/nvm@1.8.4/install.sh | bash
```

or wget:

```bash
export NVM_HOME=~/nvm; wget -qO- https://unpkg.com/@jchip/nvm@1.8.4/install.sh | bash
```

### Installing from jsdelivr.net

Retrieve the install script from [jsdelivr.net](https://www.jsdelivr.com/):

Using cURL and the install script:

```bash
export NVM_HOME=~/nvm; curl -o- https://cdn.jsdelivr.net/npm/@jchip/nvm@1.8.4/install.sh | bash
```

or wget:

```bash
export NVM_HOME=~/nvm; wget -qO- https://cdn.jsdelivr.net/npm/@jchip/nvm@1.8.4/install.sh | bash
```

### Shell Initialization on Unix

The Universal NVM installation automatically updates your shell profile files to initialize nvm. The behavior differs between zsh and bash:

#### Zsh (macOS default)

For zsh users, the installer updates both `.zshenv` and `.zshrc`:

- **`.zshenv`**: Sourced for ALL shells (interactive and non-interactive)
- **`.zshrc`**: Sourced for interactive shells only

This means:
- ✅ Terminal sessions have nvm available
- ✅ Non-interactive scripts have nvm available
- ✅ GUI applications (like VS Code) have nvm available (when combined with `nvx --install-to-user`)

#### Bash

For bash users, the installer updates `.bashrc` or `.bash_profile`:

- **`.bash_profile`**: Sourced for login shells (macOS default)
- **`.bashrc`**: Sourced for interactive non-login shells (Linux default)
- **Non-interactive shells**: NOT sourced by default

This means:
- ✅ Terminal sessions have nvm available
- ❌ Non-interactive bash scripts do NOT have nvm by default

**Using nvm in bash scripts:**

If you need nvm in a bash script, you have three options:

1. **Source the profile explicitly** in your script:
   ```bash
   #!/bin/bash
   source ~/.bashrc
   node --version
   ```

2. **Use a login shell** with the shebang:
   ```bash
   #!/bin/bash -l
   node --version
   ```

3. **Set BASH_ENV** to automatically source a file for non-interactive shells:
   ```bash
   export BASH_ENV=~/.bashrc
   ```

   You can add this to your `.bash_profile` to make it permanent, but be aware this will affect all bash scripts system-wide.

**Note:** This is standard bash behavior by design - non-interactive shells have a minimal environment for performance and predictability.

## Usage

```
Usage: nvm <command> [options]

Commands:
  nvm install <version>      install the given version of Node.js
  nvm uninstall <version>    uninstall the given version of Node.js
  nvm use <version>          use the given version of Node.js in current shell
  nvm auto-use [action]      automatically use version from .nvmrc, .node-version,
                             or package.json
       nvm auto-use enable [--cd]  - enable automatic switching on cd
         --cd: use cd wrapper mode (more efficient, only triggers on cd command)
       nvm auto-use disable        - disable automatic switching
  nvm stop                   undo effects of nvm in current shell
                                                                [aliases: unuse]
  nvm link <version>         permanently link the version of Node.js as default
  nvm unlink                 permanently unlink the default version
  nvm ls                     list all the installed Node.js versions
  nvm ls-remote              list remote versions available for install
  nvm cleanup                remove stale local caches
  nvm postinstall [version]
       Invoke custom post install script for the given version
  nvm init-env
       (windows) Generate cmd file to initialize env for nvm
  nvm undo-env               (windows) Generate cmd file to undo env for nvm

Options:
  --proxy, -p                   Set network proxy URL                   [string]
  --verifyssl, --ssl, --no-ssl  Turn on/off verify SSL certificate
                                                       [boolean] [default: true]
  --corepack, --no-corepack     Enable corepack after installation
                                                                       [boolean]
  --latest                      Match latest version to uninstall
  --version, -V, -v             Show version number
  --help, -?, -h                Show help. Add a command to show its help
                                                                        [string]

Error: No command given

envs:

  NVM_PROXY - set proxy URL
  HTTP_PROXY - fallback proxy for HTTP requests
  HTTPS_PROXY - fallback proxy for HTTPS requests
  NVM_VERIFY_SSL - (true/false) turn on/off SSL certificate verification (default: true)
  NVM_COREPACK_ENABLED - (true/false) enable corepack on install (default: false)

  Proxy priority: -p flag > NVM_PROXY > HTTPS_PROXY > HTTP_PROXY

Examples:

    nvm install lts
    nvm install latest
    nvm install 20 --corepack
    nvm use 20
    nvm uninstall 22.3

doc: https://www.npmjs.com/package/@jchip/nvm

```

### Auto-Use: Automatic Version Switching

Universal NVM can automatically switch Node.js versions when you change directories. When enabled, it will check for `.nvmrc`, `.node-version`, or `package.json` files and automatically switch to the specified version.

**Quick Start:**

```bash
# Enable automatic switching (modifies your shell profile)
nvm auto-use enable

# Enable with cd wrapper mode (more efficient, recommended)
nvm auto-use enable --cd

# Disable automatic switching
nvm auto-use disable

# Manually switch to version specified in current directory
nvm auto-use
```

**Two modes available:**

Auto-use offers two different modes for triggering version switches:

1. **Prompt-based mode** (default) - Runs on every prompt
   - ✅ Catches ALL directory changes (cd, pushd, GUI navigation, terminal opening)
   - ⚠️ Slightly more overhead (runs every time you press Enter)
   - Best for: Ensuring you never miss a version switch

2. **cd wrapper mode** (`--cd` flag) - Runs only on cd commands
   - ✅ More efficient (only runs when you actually change directories)
   - ✅ Cleaner (direct cause and effect)
   - ⚠️ Misses directory changes from `pushd`, `popd`, or terminal opening in new location
   - Best for: Performance-conscious users who primarily use `cd`

**Which mode to choose:**

```bash
# Use prompt-based if you want comprehensive coverage
nvm auto-use enable

# Use cd wrapper if you prefer efficiency
nvm auto-use enable --cd
```

**Note for Zsh users:** Zsh always uses the optimal `chpwd_functions` mechanism (triggers only on actual directory change), so the `--cd` flag has no effect. Zsh users automatically get the best of both worlds!

**What `nvm auto-use enable` does:**

- **Bash/Zsh:** Adds auto-use setup to `~/.bashrc`, `~/.bash_profile`, or `~/.zshrc`
- **PowerShell:** Adds auto-use setup to your PowerShell profile (`$PROFILE`)
- Automatically detects your shell and modifies the correct profile file

After enabling, restart your terminal or source your profile:
```bash
source ~/.bashrc       # Bash on Linux
source ~/.bash_profile # Bash on macOS
source ~/.zshrc        # Zsh
. $PROFILE             # PowerShell
```

**How it works:**
- When you change directories, auto-use checks for version files (`.nvmrc`, `.node-version`, or `package.json`)
- If found and a different version is needed, it switches and shows: `Using node v20.10.0 (auto-use from .nvmrc)`
- If the version is already active, it does nothing (fast and silent!)
- If the version isn't installed, it shows an error **once per shell session**: `Version 16.0.0 from .nvmrc not installed`
  - The error is only shown once - subsequent `cd` commands won't repeat the same error
  - This helps you know which version to install without spamming your terminal
- If no version file is found, it does nothing (no error messages)

**Manual vs Automatic invocation:**
- **Automatic** (via `cd`/prompt hooks): Uses `--silent` flag to suppress "no version file found" errors
- **Manual** (typing `nvm auto-use`): Shows all messages including "no version file found" errors

When auto-use is triggered automatically by changing directories, you'll see:
- ✓ Version switch messages (always shown)
- ✓ "Version not installed" errors (shown once per shell session)
- ✗ "No version file found" errors (suppressed)

### Version Files (.nvmrc, .node-version, and package.json)

When you run `nvm use` or `nvm auto-use` without specifying a version, Universal NVM will automatically look for a version specification in the current directory.

**Supported sources (in priority order):**

1. **`.nvmrc`** - nvm-specific version file (checked first)
2. **`.node-version`** - Universal Node.js version file (checked if .nvmrc not found)
3. **`package.json` → `engines.node`** - Fallback to package.json engines field (checked if no version files exist)

**Usage:**

```bash
# Option 1: Create a .nvmrc file
echo "20.10.0" > .nvmrc

# Option 2: Create a .node-version file
echo "20.10.0" > .node-version

# Option 3: Use package.json engines.node
cat > package.json << EOF
{
  "name": "my-project",
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF

# Use the version specified in any of these sources
nvm use
# Output varies based on source:
# - Read version 20.10.0 from .nvmrc
# - Read version 20.10.0 from .node-version
# - Read node requirement ">=18.0.0" from package.json
#   Found installed version v20.10.0 matching ">=18.0.0"
```

**File format:**

`.nvmrc` and `.node-version` files should contain a plain text version number on a single line:

```
20.10.0
```

Or with the `v` prefix:

```
v20.10.0
```

**Semver ranges:**

All version sources support semantic versioning (semver) ranges. Universal NVM will automatically select the **highest installed version** that satisfies the requirement.

**In .nvmrc or .node-version:**

```
>=18.0.0
```

```
^20.0.0
```

```
20
```

**In package.json engines.node:**

The `engines.node` field supports the same semver syntax:

```json
{
  "engines": {
    "node": ">=18.0.0"        // Any version 18 or higher
  }
}
```

```json
{
  "engines": {
    "node": "^20.0.0"         // Latest 20.x version
  }
}
```

```json
{
  "engines": {
    "node": ">=18.0.0 <21.0.0"  // Version 18 or 20, but not 21+
  }
}
```

If no installed version matches a semver range, you'll see a helpful error message suggesting which version to install.

**Priority when multiple sources exist:**

If multiple version sources exist in the same directory, Universal NVM will prefer them in this order:

```bash
# With all three present
$ cat .nvmrc
18.20.0

$ cat .node-version
20.10.0

$ cat package.json
{
  "engines": { "node": ">=16.0.0" }
}

$ nvm use
# Output: Read version 18.20.0 from .nvmrc
# .node-version and package.json are ignored
```

**Benefits of each approach:**

**`.nvmrc`** - Best for teams using traditional nvm:
- Standard for nvm users
- Supports both exact versions and semver ranges
- Most familiar to developers using nvm

**`.node-version`** - Best for cross-tool compatibility:
- Universal standard for Node.js version specification
- Supports both exact versions and semver ranges
- Makes your project more portable

**`package.json` engines.node** - Best for existing projects:
- Already part of Node.js ecosystem
- Supports semver ranges for flexibility
- Single source of truth (no separate version file needed)
- Automatically used as fallback if no .nvmrc or .node-version exists

### Environments

These env flags can be set:

| name             | values         | description                                 |
| ---------------- | -------------- | ------------------------------------------- |
| `NVM_PROXY`      | string         | An URL to a network proxy (highest priority) |
| `https_proxy`    | string         | An URL to a network proxy for HTTPS (lowercase, npm convention) |
| `HTTPS_PROXY`    | string         | An URL to a network proxy for HTTPS (uppercase) |
| `http_proxy`     | string         | An URL to a network proxy for HTTP (lowercase, npm convention) |
| `HTTP_PROXY`     | string         | An URL to a network proxy for HTTP (uppercase) |
| `NVM_VERIFY_SSL` | `true`/`false` | Controls SSL certificate verification (default: `true`) |
| `NVM_COREPACK_ENABLED` | `true`/`false` | Enable corepack after installation (default: `false`) |

**Proxy Priority:**
1. Command-line `-p` flag (highest priority)
2. `NVM_PROXY` (overrides all protocol-specific proxies)
3. Protocol-specific proxy (matches URL being fetched):
   - For HTTPS URLs: `https_proxy` → `HTTPS_PROXY` → `http_proxy` → `HTTP_PROXY`
   - For HTTP URLs: `http_proxy` → `HTTP_PROXY`

Following npm convention, lowercase environment variables are checked first, then uppercase.

#### SSL Certificate Verification (`NVM_VERIFY_SSL`)

By default, Universal NVM verifies SSL/TLS certificates when downloading Node.js from distribution servers. This ensures you're downloading from a trusted source.

**When to disable SSL verification:**

You may need to set `NVM_VERIFY_SSL=false` in these scenarios:

- **Corporate proxies with SSL inspection** - Your company's network intercepts HTTPS connections with self-signed certificates
- **Internal mirrors** - You're using an internal Node.js mirror with self-signed certificates
- **Development environments** - Testing with local servers using self-signed certificates

**How to use:**

```bash
# Disable SSL verification via environment variable (Unix/macOS)
export NVM_VERIFY_SSL=false
nvm install lts

# Disable SSL verification via environment variable (Windows PowerShell)
$Env:NVM_VERIFY_SSL = "false"
nvm install lts

# Disable SSL verification via command-line flag
nvm install lts --no-ssl
```

**Security Warning:** Disabling SSL verification makes you vulnerable to man-in-the-middle attacks. Only disable it when you trust your network and understand the risks. Re-enable verification after completing your task:

```bash
# Re-enable SSL verification (Unix/macOS)
export NVM_VERIFY_SSL=true

# Re-enable SSL verification (Windows PowerShell)
$Env:NVM_VERIFY_SSL = "true"
```

#### Corepack Support (`NVM_COREPACK_ENABLED`)

Corepack is a built-in Node.js feature (available since v16.9.0) that manages package managers like Yarn and pnpm. It allows you to use the exact package manager version specified in your project's `package.json` without manually installing them.

**When to enable corepack:**

- **Using Yarn or pnpm** - Your project uses Yarn or pnpm instead of npm
- **Version consistency** - You want to ensure everyone on your team uses the same package manager version
- **Modern projects** - You're working with projects that specify `packageManager` in package.json

**How to use:**

```bash
# Enable corepack via environment variable (Unix/macOS)
export NVM_COREPACK_ENABLED=true
nvm install lts

# Enable corepack via environment variable (Windows PowerShell)
$Env:NVM_COREPACK_ENABLED = "true"
nvm install lts

# Enable corepack via command-line flag (one-time)
nvm install 20 --corepack

# Disable corepack for a specific installation
nvm install 18 --no-corepack
```

**What corepack does:**

After installing Node.js, Universal NVM will automatically run `corepack enable`, which:
- Makes `yarn` and `pnpm` commands available
- Respects the `packageManager` field in your `package.json`
- Automatically uses the correct package manager version for your project

**Example package.json with packageManager:**

```json
{
  "name": "my-project",
  "packageManager": "pnpm@9.1.0",
  "dependencies": {
    "express": "^4.18.0"
  }
}
```

With corepack enabled, running `pnpm install` will automatically use pnpm version 9.1.0, even if you don't have it installed globally.

**Note:** If corepack fails to enable (e.g., on Node.js versions before v16.9.0), Universal NVM will show a warning but will not fail the installation. You can manually enable it later with:

```bash
corepack enable
```

**Priority:** `--corepack` flag > `NVM_COREPACK_ENABLED` env var > default (`false`)

## nvx - Execute with local node_modules

The `nvx` command allows you to run commands from your local `node_modules/.bin` directory without needing to specify the full path. It only runs locally installed packages, making it fast and predictable for running project-specific tools.

### Basic Usage

```bash
# Run eslint from local node_modules
nvx eslint src/

# Run prettier from local node_modules
nvx prettier --write .

# Run any locally installed CLI tool
nvx jest --watch
```

### Show Help

```bash
nvx --help
# or
nvx -h
```

### Installing to PATH (macOS/Linux only)

On macOS and Linux, you can optionally add the Universal NVM bin directory to your system PATH to make nvm commands available in GUI applications (like VS Code).

#### Install to User PATH (recommended)

This adds Universal NVM to your user's PATH. Works with GUI applications and doesn't require sudo:

**macOS:**
```bash
nvx --install-to-user
# Log out and log back in for changes to take effect
```

**Linux:**
```bash
nvx --install-to-user
# Log out and log back in for changes to take effect
```

#### Install to System PATH (all users)

This adds Universal NVM to the system-wide PATH for all users. Requires sudo:

**macOS:**
```bash
sudo nvx --install-to-system
# Restart your terminal for changes to take effect
```

**Linux:**
```bash
sudo nvx --install-to-system
# Log out and log back in for changes to take effect
```

**Note for Windows users:** On Windows, the installation script automatically adds both `%NVM_HOME%\bin` and `%NVM_LINK%` to your user PATH in the Windows registry. This makes Universal NVM, node, and npm immediately available to all applications (terminal, GUI apps like VS Code, etc.) without needing to run any additional commands. The `nvx --install-to-user` and `nvx --install-to-system` commands are therefore not needed on Windows.

#### How it Works

The `nvx --install-to-user` command uses platform-specific mechanisms to make Universal NVM available to GUI applications:

**macOS:**

Creates a LaunchAgent at `~/Library/LaunchAgents/com.jchip.universal-nvm.plist` that runs at login to set environment variables for the user session. This makes Universal NVM available to:
- All GUI applications (VS Code, editors, etc.)
- Terminal windows
- Background processes

The LaunchAgent adds both paths to your environment:
- `~/nvm/bin` - nvm commands (nvm, nvx)
- `~/nvm/nodejs/bin` - Node.js executables (node, npm) - only available after running `nvm link <version>`

**Linux:**

Creates a systemd user environment file at `~/.config/environment.d/10-jchip-universal-nvm.conf`. This file is read by systemd-based desktop environments at login and makes Universal NVM available to:
- All GUI applications launched from the desktop
- Applications started by systemd user services
- Any process in your user session

The environment file adds both paths:
- `~/nvm/bin` - nvm commands (nvm, nvx)
- `~/nvm/nodejs/bin` - Node.js executables (node, npm) - only available after running `nvm link <version>`

**Important:** The `~/nvm/nodejs/bin` directory is a symlink created by `nvm link <version>` that points to the default Node.js version. You must run `nvm link` to set up a default Node.js version before GUI applications can access node and npm. The install script does this automatically.

**Note:** On Linux systems not using systemd, this feature may not work. In that case, you can manually add the paths to your `~/.profile` or consult your distribution's documentation for setting user environment variables.

## Contributing and Release

### Development

1. Clone the repository
2. Install [fyn](https://www.npmjs.com/package/fyn) globally: `npm install -g fyn`
3. Install dependencies: `fyn install`
4. Make your changes
5. Run tests: `fyn run test`
6. Run tests in watch mode: `fyn run test:watch`
7. Run tests with coverage: `fyn run test:coverage`
8. Test your changes on the target platform(s)

**Testing:**

This project uses [Vitest](https://vitest.dev/) for testing. The test suite includes:
- Unit tests for proxy configuration and priority logic
- Integration tests with a custom test proxy server
- Tests for malformed requests and error handling
- Real-world tests with nodejs.org URLs

### Release Process

This project uses `xrun` for versioning and releasing. **Do not use `npm version` or `npm publish`** directly.

1. **Update CHANGELOG.md** - Add a new entry at the top with the version and date:
   ```markdown
   ## X.Y.Z MMM DD, YYYY

   - feat: description of new feature
   - fix: description of bug fix
   ```

2. **Bump version** - Choose the appropriate version bump:
   ```bash
   xrun version --patch   # Bug fixes (1.7.0 -> 1.7.1)
   xrun version --minor   # New features (1.7.0 -> 1.8.0)
   xrun version --major   # Breaking changes (1.7.0 -> 2.0.0)
   ```

3. **Release** - Publish to npm:
   ```bash
   xrun release
   ```

## License

[MIT](http://www.opensource.org/licenses/MIT)
