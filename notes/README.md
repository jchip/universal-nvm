# universal-nvm — project notes

Cross-platform Node.js version manager (`unvm` / `nvm` / `nvx`). POSIX (`lib/common-posix.js`),
Windows PowerShell + cmd (`lib/common-win32.js`), shared logic in `lib/common.js`. Shell wrappers
(`bin/unvm.sh`, `bin/unvm.cmd`, PowerShell) source a generated env script to mutate the parent shell.

Current version: **1.11.1** · default branch: `main`.

## Where to look first

- **[review-status.md](review-status.md)** — running status of the 2026-06 security/quality review:
  what's fixed (with commit hashes) and the remaining backlog. **Start here for current status.**

## Conventions

- Ephemeral planning/design docs live here in `notes/`; stale ones move to `notes/archive/`.
- Scratch/debug files go in `.temp/` (currently holds injection-test reproducers).
- Commits: subject line only, no body. Fixes go straight to `main` (small solo project).
