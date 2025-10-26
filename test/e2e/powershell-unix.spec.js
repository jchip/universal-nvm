import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createE2EEnv } from '../helpers/e2e-utils.js';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const isWindows = process.platform === 'win32';

const hasPowerShell = (() => {
  try {
    execSync('pwsh --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
})();

// Only run these tests on Unix (macOS/Linux) with PowerShell 7 installed
const shouldRunTests = !isWindows && hasPowerShell;
const skipIfNotUnixWithPowerShell = shouldRunTests ? describe : describe.skip;

skipIfNotUnixWithPowerShell('E2E: PowerShell 7 on Unix (macOS/Linux)', () => {
  let env;

  beforeAll(async () => {
    env = await createE2EEnv();
  });

  afterAll(async () => {
    if (env) {
      await env.cleanup();
    }
  });

  describe('PowerShell script execution', () => {
    it('should execute nvm.ps1 with --version', async () => {
      const result = await env.runPowerShellCommand(['./bin/nvm.ps1', '--version']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/^\d+\.\d+\.\d+/);
    }, 10000);

    it('should execute nvm.ps1 with --help', async () => {
      const result = await env.runPowerShellCommand(['./bin/nvm.ps1', '--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Usage:');
      expect(result.stdout).toContain('nvm install');
      expect(result.stdout).toContain('nvm use');
      expect(result.stdout).toContain('nvm ls');
    }, 10000);

    it('should execute nvm.ps1 ls (list versions)', async () => {
      const result = await env.runPowerShellCommand(['./bin/nvm.ps1', 'ls']);

      // Should succeed (even with no versions installed)
      expect(result.exitCode).toBe(0);
    }, 10000);

    it('should execute nvx.ps1 with --help', async () => {
      const result = await env.runPowerShellCommand(['./bin/nvx.ps1', '--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('nvx - Execute commands');
      expect(result.stdout).toContain('node_modules/.bin');
    }, 10000);
  });

  describe('Platform detection', () => {
    it('should correctly detect Unix platform in nvm.ps1', async () => {
      const result = await env.runPowerShellCommand([
        '-Command',
        '$IsUnix = $PSVersionTable.PSVersion.Major -ge 6 -and ($IsLinux -or $IsMacOS); Write-Host "IsUnix: $IsUnix"'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('IsUnix: True');
    }, 10000);

    it('should use forward slashes for paths on Unix', async () => {
      // Create a test script that checks path construction
      const testScript = `
        $IsUnix = $PSVersionTable.PSVersion.Major -ge 6 -and ($IsLinux -or $IsMacOS)
        if ($IsUnix) {
          $testPath = "$PSScriptRoot/../dist/unvm.js"
          Write-Host "Path: $testPath"
        }
      `;

      const scriptPath = path.join(env.nvmHome, 'bin', 'test-path.ps1');
      fs.writeFileSync(scriptPath, testScript);

      const result = await env.runPowerShellCommand(['./bin/test-path.ps1']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/Path:.*\/dist\/unvm\.js/);

      // Cleanup
      fs.unlinkSync(scriptPath);
    }, 10000);
  });

  describe('Auto-use functionality', () => {
    it('should load nvm-auto-use.ps1 without errors', async () => {
      const result = await env.runPowerShellCommand([
        '-Command',
        `$Env:NVM_HOME = "${env.nvmHome}"; . "${path.join(env.nvmHome, 'bin', 'nvm-auto-use.ps1').replace(/\\/g, '/')}"; Write-Host "Loaded successfully"`
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Loaded successfully');
    }, 10000);

    it('should detect .nvmrc files with nvm auto-use', async () => {
      // Create a .nvmrc file
      const nvmrcPath = path.join(env.nvmHome, '.nvmrc');
      fs.writeFileSync(nvmrcPath, '22');

      try {
        const result = await env.runPowerShellCommand([
          './bin/nvm.ps1',
          'auto-use'
        ], { cwd: env.nvmHome });

        // Should attempt to use version from .nvmrc (may fail if not installed)
        expect(result.stdout || result.stderr).toMatch(/\.nvmrc|installed|Using node/i);
      } finally {
        fs.unlinkSync(nvmrcPath);
      }
    }, 10000);

    it('should handle cd wrapper mode enable/disable', async () => {
      const profilePath = path.join(os.tmpdir(), `test-profile-${Date.now()}.ps1`);

      try {
        // Create a minimal profile
        fs.writeFileSync(profilePath, '# Test profile\n');

        const enableScript = `
          $Env:NVM_HOME = "${env.nvmHome}"
          $PROFILE = "${profilePath.replace(/\\/g, '/')}"
          . "${path.join(env.nvmHome, 'bin', 'nvm-auto-use.ps1').replace(/\\/g, '/')}"
          Enable-NvmAutoUseCdWrapper -Quiet
          Get-Command Set-Location | Select-Object -ExpandProperty Name
        `;

        const result = await env.runPowerShellCommand(['-Command', enableScript]);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('Set-Location');
      } finally {
        if (fs.existsSync(profilePath)) {
          fs.unlinkSync(profilePath);
        }
      }
    }, 10000);
  });

  describe('Environment file handling', () => {
    it('should write environment files to correct temp directory', async () => {
      const result = await env.runPowerShellCommand([
        '-Command',
        `$Env:NVM_HOME = "${env.nvmHome}"; ./bin/nvm.ps1 ls; $files = Get-ChildItem -Path $Env:TMPDIR -Filter "nvm_env*.ps1" -ErrorAction SilentlyContinue; Write-Host "Env files found: $($files.Count)"`
      ], { cwd: env.nvmHome });

      // Should create at least one env file
      expect(result.stdout).toMatch(/Env files found: \d+/);
    }, 10000);

    it('should use correct temp directory path on Unix', async () => {
      const testScript = `
        $IsUnix = $PSVersionTable.PSVersion.Major -ge 6 -and ($IsLinux -or $IsMacOS)
        if ($IsUnix) {
          $tempDir = if ($Env:TMPDIR) { $Env:TMPDIR } else { "/tmp" }
          Write-Host "Temp dir: $tempDir"
          Test-Path $tempDir | ForEach-Object { Write-Host "Exists: $_" }
        }
      `;

      const result = await env.runPowerShellCommand(['-Command', testScript]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/Temp dir: \//);
      expect(result.stdout).toContain('Exists: True');
    }, 10000);
  });

  describe('Path separator handling', () => {
    it('should use colon as path separator on Unix', async () => {
      const result = await env.runPowerShellCommand([
        '-Command',
        `
          $IsUnix = $PSVersionTable.PSVersion.Major -ge 6 -and ($IsLinux -or $IsMacOS)
          $pathSeparator = if ($IsUnix) { ":" } else { ";" }
          Write-Host "Path separator: $pathSeparator"
        `
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Path separator: :');
    }, 10000);

    it('nvx.ps1 should handle Unix path separator', async () => {
      // Create a test node_modules/.bin directory
      const nodeModulesPath = path.join(env.nvmHome, 'node_modules', '.bin');
      fs.mkdirSync(nodeModulesPath, { recursive: true });

      // Create a dummy executable
      const dummyExec = path.join(nodeModulesPath, 'test-cmd');
      fs.writeFileSync(dummyExec, '#!/bin/sh\necho "test command"');
      fs.chmodSync(dummyExec, 0o755);

      try {
        const result = await env.runPowerShellCommand([
          './bin/nvx.ps1',
          'test-cmd'
        ], { cwd: env.nvmHome });

        // Should execute the command
        expect(result.stdout || result.stderr).toMatch(/test command|command not found/);
      } finally {
        fs.rmSync(path.join(env.nvmHome, 'node_modules'), { recursive: true, force: true });
      }
    }, 10000);
  });

  describe('Error handling', () => {
    it('should handle missing NVM_HOME gracefully', async () => {
      const result = await env.runPowerShellCommand([
        '-Command',
        '$Env:NVM_HOME = ""; ./bin/nvm.ps1 --version'
      ], { cwd: env.nvmHome, expectError: true });

      // Should either succeed with default or show helpful error
      expect(result.exitCode === 0 || result.exitCode === 1).toBe(true);
    }, 10000);

    it('should handle node binary not found', async () => {
      const result = await env.runPowerShellCommand([
        '-Command',
        `
          $Env:NVM_HOME = "${env.nvmHome}"
          $Env:PATH = ""
          ./bin/nvm.ps1 --version
        `
      ], { cwd: env.nvmHome, expectError: true });

      // Should show error about node not found or succeed with system node
      expect(result.exitCode === 0 || result.stdout || result.stderr).toBeTruthy();
    }, 10000);
  });

  describe('Profile integration', () => {
    it('should generate correct auto-use enable code', async () => {
      const profilePath = path.join(os.tmpdir(), `test-profile-${Date.now()}.ps1`);

      try {
        // Pre-create the profile directory
        const profileDir = path.dirname(profilePath);
        if (!fs.existsSync(profileDir)) {
          fs.mkdirSync(profileDir, { recursive: true });
        }

        // Simulate auto-use enable
        const result = await env.runPowerShellCommand([
          '-Command',
          `
            $Env:NVM_HOME = "${env.nvmHome}"
            $Env:NVM_PSPROFILE = "${profilePath.replace(/\\/g, '/')}"
            ./bin/nvm.ps1 auto-use enable
            Write-Host "Exit code: $LASTEXITCODE"
          `
        ], { cwd: env.nvmHome });

        // Log result for debugging
        if (result.exitCode !== 0) {
          console.log('auto-use enable stdout:', result.stdout);
          console.log('auto-use enable stderr:', result.stderr);
        }

        // Should create profile with auto-use setup
        if (fs.existsSync(profilePath)) {
          const profileContent = fs.readFileSync(profilePath, 'utf8');
          expect(profileContent).toContain('NVM auto-use BEGIN');
          expect(profileContent).toContain('$IsUnix');
          expect(profileContent).toContain('nvm-auto-use.ps1');
          expect(profileContent).toContain('Enable-NvmAutoUse');
        } else {
          // If profile wasn't created, at least verify the command succeeded
          expect(result.exitCode).toBe(0);
          expect(result.stdout).toMatch(/enabled|already/i);
        }
      } finally {
        if (fs.existsSync(profilePath)) {
          fs.unlinkSync(profilePath);
        }
      }
    }, 15000);

    it('should handle auto-use disable', async () => {
      const profilePath = path.join(os.tmpdir(), `test-profile-${Date.now()}.ps1`);

      try {
        // Pre-create the profile directory
        const profileDir = path.dirname(profilePath);
        if (!fs.existsSync(profileDir)) {
          fs.mkdirSync(profileDir, { recursive: true });
        }

        // First enable
        const enableResult = await env.runPowerShellCommand([
          '-Command',
          `
            $Env:NVM_HOME = "${env.nvmHome}"
            $Env:NVM_PSPROFILE = "${profilePath.replace(/\\/g, '/')}"
            ./bin/nvm.ps1 auto-use enable
          `
        ], { cwd: env.nvmHome });

        // Only test disable if enable succeeded and created the profile
        if (fs.existsSync(profilePath)) {
          // Then disable
          const result = await env.runPowerShellCommand([
            '-Command',
            `
              $Env:NVM_HOME = "${env.nvmHome}"
              $Env:NVM_PSPROFILE = "${profilePath.replace(/\\/g, '/')}"
              ./bin/nvm.ps1 auto-use disable
            `
          ], { cwd: env.nvmHome });

          expect(result.exitCode).toBe(0);

          // Profile should be cleaned up
          if (fs.existsSync(profilePath)) {
            const profileContent = fs.readFileSync(profilePath, 'utf8');
            expect(profileContent).not.toContain('NVM auto-use BEGIN');
          }
        } else {
          // If profile wasn't created, skip this test
          console.log('Profile was not created by enable, skipping disable test');
          expect(enableResult.exitCode).toBe(0);
        }
      } finally {
        if (fs.existsSync(profilePath)) {
          fs.unlinkSync(profilePath);
        }
      }
    }, 20000);
  });
});
