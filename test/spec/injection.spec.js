import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { execFileSync, spawnSync } from 'child_process';
import path from 'path';
import os from 'os';

const common = require('../../lib/common');
const win32 = require('../../lib/common-win32');

const isWindows = process.platform === 'win32';
const onPosix = isWindows ? it.skip : it;

// PowerShell Core is cross-platform (same parser on Windows and *nix), so when
// it's available we can validate the Windows env-script quoting against the real
// engine on any OS - same approach as test/e2e/powershell-unix.spec.js.
let hasPwsh = false;
try {
  hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', 'exit 0'], { timeout: 15000 }).status === 0;
} catch {
  hasPwsh = false;
}
const onPwsh = hasPwsh ? it : it.skip;

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

// Regression tests for the auto-use command-injection vector: a hostile
// .nvmrc / .node-version value used to flow unescaped into the env script that
// the shell wrappers `source`/`eval` (bin/unvm.sh, nvm.ps1, nvm.cmd), so simply
// cd-ing into a repo could execute arbitrary code. Fixed by quoting at every
// script sink (lib/common-posix.js, lib/common-win32.js) and validating the
// version spec at the input boundary (lib/common.getNodeVersionFromFile).
describe('shell-injection hardening (auto-use env handshake)', () => {
  let tmpDir;
  let originalEnv;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nvm-injection-test-'));
  });

  afterEach(async () => {
    process.env = originalEnv;
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  describe('POSIX env scripts cannot execute injected commands when sourced', () => {
    onPosix(
      'createEnvironmentTmp neutralizes NVM_AUTO_USE_SHOWN_ERRORS payloads',
      async () => {
        const sentinel = path.join(tmpDir, 'pwned');
        const envFile = path.join(tmpDir, 'nvm_env.sh');
        const payload = `.nvmrc:1.2.$(touch ${sentinel})`;

        process.env.NVM_USE = '';
        process.env.NVM_AUTO_USE_SHOWN_ERRORS = payload;
        process.env.PATH = '/usr/bin:/bin';

        await common.createEnvironmentTmp(envFile);

        // child starts WITHOUT the payload var so only the file can set it
        const childEnv = { ...process.env };
        delete childEnv.NVM_AUTO_USE_SHOWN_ERRORS;

        const out = execFileSync(
          'sh',
          ['-c', `. "${envFile}"; printf %s "$NVM_AUTO_USE_SHOWN_ERRORS"`],
          { encoding: 'utf8', env: childEnv }
        );

        // command substitution must NOT have run...
        expect(await exists(sentinel)).toBe(false);
        // ...and the literal value round-trips intact
        expect(out).toBe(payload);
      }
    );

    onPosix('getSetInstallEnvScript neutralizes a hostile version string', async () => {
      const sentinel = path.join(tmpDir, 'pwned2');
      const envFile = path.join(tmpDir, 'install_env.sh');
      const payload = `1.2.3\`touch ${sentinel}\``;
      process.env.PATH = '/usr/bin:/bin';

      await fs.writeFile(envFile, common.getSetInstallEnvScript(payload));

      const out = execFileSync(
        'sh',
        ['-c', `. "${envFile}"; printf %s "$NVM_INSTALL"`],
        { encoding: 'utf8' }
      );

      expect(await exists(sentinel)).toBe(false);
      expect(out).toBe(payload);
    });
  });

  describe('Windows env scripts quote/strip untrusted values', () => {
    it('PowerShell wraps values in single-quoted literals (no $() evaluation)', () => {
      process.env.NVM_POWERSHELL = '1';
      process.env.NVM_USE = 'v20.10.0';
      process.env.PATH = 'C:\\Windows';

      process.env.NVM_AUTO_USE_SHOWN_ERRORS = '.nvmrc:$(rm -rf /)';
      expect(win32.getDefaultEnvScript()).toContain(
        `$Env:NVM_AUTO_USE_SHOWN_ERRORS='.nvmrc:$(rm -rf /)'`
      );

      // an embedded single quote is doubled, not left to break out of the literal
      process.env.NVM_AUTO_USE_SHOWN_ERRORS = `a';calc;'b`;
      expect(win32.getDefaultEnvScript()).toContain(
        `$Env:NVM_AUTO_USE_SHOWN_ERRORS='a'';calc;''b'`
      );
    });

    it('cmd strips characters that break out of SET "VAR=..."', () => {
      delete process.env.NVM_POWERSHELL;
      process.env.NVM_USE = 'v20.10.0';
      process.env.PATH = 'C:\\Windows';
      process.env.NVM_AUTO_USE_SHOWN_ERRORS = '.nvmrc:%PATH%"& calc';

      const script = win32.getDefaultEnvScript();

      // % (expansion) and " (quote break-out) removed; & stays but is inert in quotes
      expect(script).toContain('SET "NVM_AUTO_USE_SHOWN_ERRORS=.nvmrc:PATH& calc"');
      expect(script).not.toContain('%PATH%');
    });
  });

  describe('getNodeVersionFromFile rejects non-semver content at the boundary', () => {
    let originalCwd;

    beforeEach(() => {
      originalCwd = process.cwd();
      // isolate version resolution: empty NVM_HOME => no installed versions
      process.env.NVM_HOME = tmpDir;
      process.chdir(tmpDir);
    });

    afterEach(() => {
      process.chdir(originalCwd);
    });

    it('returns null (silent) for a .nvmrc carrying shell metacharacters', async () => {
      await fs.writeFile(path.join(tmpDir, '.nvmrc'), '1.2.$(touch pwned)\n');
      expect(await common.getNodeVersionFromFile(true)).toBeNull();
    });

    it('returns null (silent) for a .node-version with a `||` injection', async () => {
      await fs.writeFile(path.join(tmpDir, '.node-version'), '8.0.0 || $(touch pwned)\n');
      expect(await common.getNodeVersionFromFile(true)).toBeNull();
    });

    it('still accepts a legitimate semver range', async () => {
      await fs.writeFile(path.join(tmpDir, '.nvmrc'), '>=18\n');
      const result = await common.getNodeVersionFromFile(true);
      expect(result).not.toBeNull();
      expect(result.source).toBe('.nvmrc');
      expect(result.range).toBe('>=18');
    });

    it('still accepts a partial version', async () => {
      await fs.writeFile(path.join(tmpDir, '.nvmrc'), '20\n');
      const result = await common.getNodeVersionFromFile(true);
      expect(result).not.toBeNull();
      expect(result.source).toBe('.nvmrc');
      expect(result.range).toBe('20');
    });

    it('still accepts an exact pinned version', async () => {
      await fs.writeFile(path.join(tmpDir, '.nvmrc'), '20.10.0\n');
      const result = await common.getNodeVersionFromFile(true);
      expect(result).not.toBeNull();
      expect(result.version).toBe('20.10.0');
      expect(result.source).toBe('.nvmrc');
    });
  });

  // Execute the REAL getDefaultEnvScript() output in real PowerShell and prove a
  // hostile NVM_AUTO_USE_SHOWN_ERRORS value is inert when the script is sourced
  // (mirrors how nvm.ps1 dot-sources the generated env file on Windows).
  describe('Windows engine (real PowerShell) cannot execute injected values', () => {
    beforeEach(() => {
      process.env.NVM_POWERSHELL = '1';
    });

    function runPs(psFile) {
      const childEnv = { ...process.env };
      delete childEnv.NVM_AUTO_USE_SHOWN_ERRORS;
      delete childEnv.NVM_USE;
      return execFileSync(
        'pwsh',
        ['-NoProfile', '-Command', `. '${psFile}'; [Console]::Out.Write($Env:NVM_AUTO_USE_SHOWN_ERRORS)`],
        { encoding: 'utf8', env: childEnv }
      );
    }

    onPwsh('does not run a $(...) subexpression payload', async () => {
      const sentinel = path.join(tmpDir, 'ps-pwned');
      const psFile = path.join(tmpDir, 'env.ps1');
      const payload = `.nvmrc:$(New-Item -ItemType File -Force -Path '${sentinel}')`;

      process.env.NVM_USE = 'v20.10.0';
      process.env.NVM_AUTO_USE_SHOWN_ERRORS = payload;
      // leave PATH intact so pwsh itself stays locatable; getDefaultEnvScript
      // still embeds and single-quotes the real PATH, which is fine here
      await fs.writeFile(psFile, win32.getDefaultEnvScript());

      const out = runPs(psFile);

      expect(await exists(sentinel)).toBe(false);
      expect(out).toBe(payload);
    });

    onPwsh('escapes embedded single quotes (no literal break-out)', async () => {
      const sentinel = path.join(tmpDir, 'ps-pwned2');
      const psFile = path.join(tmpDir, 'env2.ps1');
      const payload = `a';New-Item -ItemType File -Force -Path '${sentinel}';'b`;

      process.env.NVM_USE = 'v20.10.0';
      process.env.NVM_AUTO_USE_SHOWN_ERRORS = payload;
      // leave PATH intact so pwsh itself stays locatable; getDefaultEnvScript
      // still embeds and single-quotes the real PATH, which is fine here
      await fs.writeFile(psFile, win32.getDefaultEnvScript());

      const out = runPs(psFile);

      expect(await exists(sentinel)).toBe(false);
      expect(out).toBe(payload);
    });
  });
});
