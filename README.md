# @jchip/nvm

A universal node.js version manager for Windows (no admin) and Unix.

- Install is simple with a PowerShell script on Windows, or a bash script on Unix.

- **No admin required on Windows to install or use.**

- A linked system wide version that can be changed any time.

- Change to any version independently in a terminal any time.

## Table Of Contents

- [@jchip/nvm](#jchipnvm)
  - [Table Of Contents](#table-of-contents)
  - [Installing Windows nvm using PowerShell](#installing-windows-nvm-using-powershell)
    - [Installing from github.com](#installing-from-githubcom)
    - [Installing from unpkg.com](#installing-from-unpkgcom)
    - [Installing from jsdelivr.net](#installing-from-jsdelivrnet)
    - [Windows 7 Updates](#windows-7-updates)
    - [Troubleshooting](#troubleshooting)
      - [Running scripts disabled](#running-scripts-disabled)
      - [No PowerShell - Manual Install](#no-powershell---manual-install)
  - [Installing Unix nvm](#installing-unix-nvm)
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

## Installing Windows nvm using PowerShell

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

If you want to use nvm with Git Bash after installing on Windows via PowerShell:

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

## Installing Unix nvm

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

The nvm installation automatically updates your shell profile files to initialize nvm. The behavior differs between zsh and bash:

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
  --latest                      Match latest version to uninstall
  --version, -V, -v             Show version number
  --help, -?, -h                Show help. Add a command to show its help
                                                                        [string]

Error: No command given

envs:

  Proxy priority: -p flag > NVM_PROXY > HTTPS_PROXY > HTTP_PROXY
  NVM_PROXY - set proxy URL
  HTTPS_PROXY - set proxy URL (standard env var)
  HTTP_PROXY - set proxy URL (standard env var)
  NVM_VERIFY_SSL - (true/false) turn on/off verify SSL certs

Examples:

    nvm install lts
    nvm install latest
    nvm use 20
    nvm uninstall 22.3

doc: https://www.npmjs.com/package/@jchip/nvm

```

### Environments

These env flags can be set:

| name             | values         | description                                 |
| ---------------- | -------------- | ------------------------------------------- |
| `NVM_PROXY`      | string         | An URL to a network proxy (higher priority than HTTP_PROXY/HTTPS_PROXY) |
| `HTTPS_PROXY`    | string         | An URL to a network proxy (standard env var) |
| `HTTP_PROXY`     | string         | An URL to a network proxy (standard env var, lowest priority) |
| `NVM_VERIFY_SSL` | `true`/`false` | turn on/off node.js verify SSL certificates |

**Proxy Priority:** Command-line `-p` flag > `NVM_PROXY` > `HTTPS_PROXY` > `HTTP_PROXY`

## nvx - Execute with local node_modules

The `nvx` command allows you to run commands from your local `node_modules/.bin` directory without needing to specify the full path.

Unlike `npx`, which can fetch and execute packages from remote npm registry, `nvx` is simpler and only runs locally installed packages. This makes it faster and more predictable for running project-specific tools.

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

On macOS and Linux, you can optionally add the nvm bin directory to your system PATH to make nvm commands available in GUI applications (like VS Code).

#### Install to User PATH (recommended)

This adds nvm to your user's PATH. Works with GUI applications and doesn't require sudo:

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

This adds nvm to the system-wide PATH for all users. Requires sudo:

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

**Note for Windows users:** On Windows, the installation script automatically adds both `%NVM_HOME%\bin` and `%NVM_LINK%` to your user PATH in the Windows registry. This makes nvm, node, and npm immediately available to all applications (terminal, GUI apps like VS Code, etc.) without needing to run any additional commands. The `nvx --install-to-user` and `nvx --install-to-system` commands are therefore not needed on Windows.

#### How it Works

The `nvx --install-to-user` command uses platform-specific mechanisms to make nvm available to GUI applications:

**macOS:**

Creates a LaunchAgent at `~/Library/LaunchAgents/com.jchip.universal-nvm.plist` that runs at login to set environment variables for the user session. This makes nvm available to:
- All GUI applications (VS Code, editors, etc.)
- Terminal windows
- Background processes

The LaunchAgent adds both paths to your environment:
- `~/nvm/bin` - nvm commands (nvm, nvx)
- `~/nvm/nodejs/bin` - Node.js executables (node, npm) - only available after running `nvm link <version>`

**Linux:**

Creates a systemd user environment file at `~/.config/environment.d/10-jchip-universal-nvm.conf`. This file is read by systemd-based desktop environments at login and makes nvm available to:
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
