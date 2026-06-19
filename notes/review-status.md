# Review status — security/quality pass (2026-06)

Last updated: **2026-06-14** · branch `main` · v1.11.1

A full cross-platform review ran in 2026-06. The dominant risk class was untrusted strings (from
`.nvmrc` / `.node-version` / `package.json`) flowing into shell/PowerShell code that gets
`source`/`eval`'d. **The one true critical bug — auto-use command injection — is fixed and verified.**
Most of the rest has also landed. This file tracks what's done vs. what remains.

## Fix commits

| Commit | Covers |
|--------|--------|
| `a65d3e5` | **Critical #1** shell injection in auto-use env scripts |
| `b9248c5` | download cleanup, ls/uninstall crash guard, unlink default layout, cmd args, test.sh gate, env file perms |
| `4091b86` | CLI `parseAsync` error propagation, atomic nvx env write, uninstaller system PATH, install_bashrc marker safety, drop dist `.map` from published files |
| `d9327f2` | bad `NVM_NODEJS_ORG_MIRROR` entry crashing ls-remote/install |
| `f779951` | install_bashrc duplicate-block idempotency |
| `d276218` | nvx `--install-to-user` surfaces skipped shell-profile instead of false success |
| `7a481b2` | nvm unlink leaving a dangling default-version symlink |
| `b1379ef` | `createEnvironmentTmp` atomic temp-file + `rename` (symlink-race / partial-write hardening) |

## ✅ Fixed & verified

- **C#1 — auto-use command injection (RCE on `cd`).** `lib/common-posix.js` routes every emitted value
  through `shQuote()` (single-quote + `'\''`), incl. the once-unquoted `NVM_INSTALL` in
  `getSetInstallEnvScript`. Windows uses `psQuote()` / `cmdSanitize()`. Boundary validation via
  `semver.validRange()` in `lib/common.js`. Covered by `test/spec/injection.spec.js` (POSIX/PS/cmd payloads).
- **H#2 — `install.sh` sourced `./test.sh` from CWD.** Now gated on `NVM_TEST` + file check.
- **H#4 — JS download poisoned cache on failed fetch.** `lib/install.js` now `rm`s `nodeCachePath` before retrying mirrors.
- **H#5 — `findLinkVersion` crash on non-version / non-symlink.** try/catch around `readlink` + null-check regex; callers `ls.js` / `uninstall.js` handle `undefined`.
- **H#6 — `cli.js` sync `.parse` swallowed async errors.** Now `parseAsync` with error handler + awaited exec.
- **M#7 — `resetNvmPaths` stripped ALL node PATH entries.** Now only removes nvm-managed dirs (under `baseDir` / `linkDir`).
- **M#8 — `nvm unlink` broken in default `.unvm` layout.** Derives via `getNvmLinkDir()`, not `process.env.NVM_LINK`.
- **M#9 — temp env scripts world-readable / predictable / non-atomic.** `mode 0o600`, `wx` (O_CREAT|O_EXCL), unique tmp name, atomic `rename`.
- **M#10 — install_bashrc malformed-marker duplicated block.** Strips existing blocks first; re-run idempotent; returns false on corrupt marker.
- **M#11 (POSIX) — profile rewrite wasn't atomic.** `bin/install_bashrc.js` now writes via sibling temp + `rename(2)` (`writeFileAtomicSync`): a crash mid-write can't truncate the user's profile. Preserves symlinked profiles (realpath write-through, for stow/chezmoi) and existing permission bits. Tests in `install-bashrc.spec.js`. _Windows registry half still open — see backlog #1._
- **M#12 — `escapePath` didn't escape `$`/backtick.** Replaced by `shQuote()` single-quoting.
- **L#13 — dead `check-registry.js` shipped in the tarball.** Moved to `tools/` and dropped from published `files`; coverage exclude now `tools/**`. (The flagged host/hostname bug was already moot — uses `url.hostname`.)
- **L#15 — webpack babel `exclude`.** Now `/node_modules/`.
- **L#16 — dist `.map` shipped to consumers.** `package.json` `files` now lists `dist/unvm.js` explicitly; `.map` not shipped.
- **L#17 (partial) — nvx Linux `--install-to-system`.** `/etc/environment` now written atomically (tmp + `mv`); uninstaller removes `/etc/paths.d/999-uni-nvm`.

## 🔧 Remaining backlog

Prioritized; none are critical. Original review IDs in brackets.

1. **[M#11 · Windows] No backup before overwriting the registry.** `install.ps1` rewrites `HKCU:\Environment`
   `Path`/`NVM_HOME` in place — atomic temp+rename doesn't apply to registry values, so stash the prior `Path`
   to a backup value/file before overwriting. _(POSIX profile half is fixed — see "Fixed & verified".)_
2. **[L#17] Uninstaller leaves the `/etc/environment` PATH line.** The Linux uninstaller removes
   `/etc/paths.d/999-uni-nvm` but only *detects* the `nvm` `PATH=` line in `/etc/environment` — it prompts for a
   manual edit rather than removing it. May be intentional caution around system files; revisit if we want full
   cleanup. (Agent-reported, unverified.)
3. **[L#14] `bin/no-npm-install.js` only prints, never `exit(1)`.** So `npm install universal-nvm` isn't
   actually blocked. Either `process.exit(1)` or stop calling it a "guard" and document as advisory.
4. **[L#18] `uninstall.js` failure-path message says "Removed … failed".** Success wording in a catch block — fix the message.
5. **[M#9b] `cleanup.js` doesn't sweep stale `nvm_env*` temp files.** Minor housekeeping; verify and add.
6. **[opt] Defense-in-depth integrity check.** Optional `SHASUMS256.txt` verification to cover `--no-ssl` /
   mirror / http modes. User's call — deemed optional given default-path reasoning.

## 🚫 Decided not to fix

- **[H#3] `bin/unvm.cmd` fixed-temp-file race** — `unvm.cmd:6` hardcodes `NVM_RUN_ID=1`, so every cmd run
  writes the same `%TMP%\nvm_env1.cmd` (the name is also hardcoded literally at `:20`/`:23`). Two `nvm` commands
  run in two cmd windows at the same instant clobber each other's env file → one shell can get the wrong Node
  version / a transient error. **Won't fix (2026-06-14).** Rationale:
  - *Not concurrent code* — `unvm` is run-once-and-exit; nothing in the tool spawns parallel runs. It takes a
    human firing two invocations in the same sub-second window.
  - *cmd is the structural weak link, not a careless bug.* `unvm.sh` keys the temp file on `$$` and `unvm.ps1`
    on `$PID`; cmd.exe has **no PID equivalent** — only `%RANDOM%` (0–32767, time-seeded, so two shells in the
    same tick can still collide). And the write-file-then-`call` handshake itself is *forced* because cmd has no
    parent-scope `source` like bash/PowerShell, so env must round-trip through a shared `%TMP%` file.
  - *A patch wouldn't be correct.* A `%RANDOM%`-based name only narrows the window, never closes it; the only
    robust fix is re-architecting how cmd hands env back — not worth a redesign for a manual-race-only payoff.
  - (The arg-truncation half of H#3 was already fixed in `b9248c5`.)

## Rejected — not a defect

- **[L#17b] `nvx` falls through to ambient `PATH` when a command isn't in a local `node_modules/.bin`.**
  By design, and it matches `npx`: npx also resolves local `.bin` → `$PATH`. The trait that defines npx — and
  that nvx deliberately drops — is auto-**fetching** a package from the npm registry to run it. nvx never
  fetches ("npx without the registry download"), so the PATH fallthrough is expected, not a contract violation —
  no warn/error guard wanted. (Was an unverified agent-reported finding; the "node_modules only" line in the
  contract means "no fetching," not "must live in node_modules.")

## 🧪 Test gaps (largely open)

- **[#20] `proxy.spec.js` copy-pastes** the `checkOpts` priority logic instead of importing `lib/cli.js` —
  ~30 tests would pass even if `checkOpts` were deleted. Highest-value fix.
- **[#21] ~30+ lifecycle e2e tests are `it.skip`'d** ("NVM_HOME isolation"). Real install/use/link/uninstall
  path is only exercised in the Linux-only Docker job (TLS off, never runs install twice → idempotency not e2e-tested).
- **[#19] No explicit tests** for `downloadNode` failure/cleanup, `enable-auto-use.js`, or `resetNvmPaths` filtering.
- **[#22] `vitest.config.mjs` sets no coverage thresholds.**
- Several "unit" specs hit nodejs.org/npmjs.org live and self-neuter (accept `[200,301,403,429]`).

## Not filed as tickets

These live here rather than in the `tasks` tracker — convert to tickets if/when picked up.
