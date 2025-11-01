## 1.11.0 Nov 1, 2025

- feat: `nvm link lts` and `nvm link latest` support
- feat: add uninstall scripts for Unix and Windows

## 1.9.0 Oct 18, 2025

- feat: add --corepack flag to enable corepack after install
- feat: reads `.node-version` and `engine` from `package.json`
- feat: use env `http_proxy` and `https_proxy`
- feat: auto-use looking for `.nvmrc`, `.node-version`, or `engine` in `package.json`

## 1.8.4 Oct 13, 2025

- fix: support gitbash on windows
- fix: nvx.ps1 improvements

## 1.8.3 Oct 13, 2025

- fix: registry PATH parsing to handle spaces

## 1.8.2 Oct 13, 2025

- fix: nvx bash version to handle windows
- fix: macos launch agent config
- fix: nvx.cmd for windows when using spawn

## 1.8.1 Oct 13, 2025

- fix: install script to use generic shell syntax
- fix: GUI and non-interactive shell config

## 1.8.0 Oct 12, 2025

- feat: add `nvx` command to run local node_modules binaries
- feat: add `nvx --install-to-user` for macOS/Linux (GUI app support, no sudo)
- feat: add `nvx --install-to-system` for macOS/Linux (system-wide, requires sudo)

## 1.7.0 Mar 8, 2025

- feat: use .nvmrc

## 1.6.4 Jun 24, 2024

- fix: allow using latest for install version

## 1.6.3 Jun 21, 2024

- fix: force install x64 for version below 16, on ARM and drawin

## 1.6.2 Apr 30, 2024

- chore: proper link when update README

## 1.6.1 Apr 30, 2024

- fix: handle requested version not matching any installed versions

## 1.6.0 Apr 8, 2024

- feat: add init-env and undo-env commands for windows
- fix: powershell clear run id
- fix: set run id for windows cmd
- fix: remove auto exec and let system Path do its job
- doc: add manual install instructions for windows
- fix: iconv-lite stub exports null so needle won't use it

## 1.5.8 Apr 5, 2024

- fix: install gracefully handles unknown version

## 1.5.7 Apr 5, 2024

- fix: where doesn't work in powershell 5.1

## 1.5.6 Mar 26, 2024

- fix LTS version detection

## 1.0.1 June 14, 2019

- Add PowerShell auto install script

## 1.0.0 October 08, 2018

- Upgrade the install logic
- Fix the uninstall error

## 0.2.1 November 08, 2016

- Replace windows x64 download path with win-x64
- Add `NVM_NODEJS_ORG_MIRROR` env support

## 0.1.5 November 09, 2014

- Fix error variable reference

## 0.1.3 November 08, 2014

- Fix npm install error which npm version is greater then 1.4.12

## 0.1.2 October 30, 2013

- Exit Node process while switch or switch-deactivate run failed

## 0.1.1 October 30, 2013

- Add switch and switch-deactivate commands

## 0.1.0 October 15, 2013

- Initial release
