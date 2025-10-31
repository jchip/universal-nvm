# Testing Installation Scripts on GitHub Actions

This guide explains how to test installation scripts across all platforms using GitHub Actions.

## Overview

We have **automated installation tests** for all three platforms:

- **Linux** → Docker integration tests (31 tests: bash, zsh, PowerShell, uninstall)
- **macOS** → install.sh test (bash/zsh integration, nvm commands)
- **Windows** → install.ps1 test (PowerShell, registry, Node.js download)

All tests run automatically on every push/PR.

---

# Testing install.ps1 Without a Windows Machine

This section explains how to test the Windows PowerShell installer (`install.ps1`) when developing on macOS or Linux.

## Option 1: GitHub Actions (Recommended) ✅

The **easiest and most reliable** method is using GitHub Actions with Windows runners.

### How It Works

Every push/PR automatically tests `install.ps1` on a real Windows environment.

**Workflow:** `.github/workflows/test.yml` → `windows-install-test` job

**What it tests:**
- ✅ Builds the project
- ✅ Runs `install.ps1` with test parameters (no GUI)
- ✅ Verifies installation:
  - NVM_HOME directory created
  - bin/ directory exists
  - nvm.ps1 installed
  - node.exe downloaded
  - nvm command works
  - Node.js runs correctly
- ✅ Cleans up test installation

### Viewing Results

1. Push your changes to GitHub
2. Go to **Actions** tab in your repository
3. Click on your commit's workflow run
4. Check the **Windows install.ps1 Test** job

### Manual Trigger

You can also manually trigger the workflow:

```bash
# Push to trigger workflow
git push origin your-branch

# Or use GitHub CLI
gh workflow run test.yml
```

## Option 2: Local Virtual Machine

If you need interactive testing, use a VM.

### Windows 11 Development VM (Free)

Microsoft provides **free Windows VMs** for development:

**Download:** https://developer.microsoft.com/en-us/windows/downloads/virtual-machines/

**Available for:**
- VirtualBox (macOS/Linux/Windows)
- VMware (macOS/Linux/Windows)
- Parallels (macOS only)
- Hyper-V (Windows only)

**Steps:**
1. Download the VM image for your hypervisor
2. Import into VirtualBox/VMware/Parallels
3. Boot the VM
4. Clone your repo inside the VM
5. Test `install.ps1` interactively

**Pros:**
- Full Windows environment
- Can test GUI dialogs
- Can test registry changes
- Real user experience

**Cons:**
- Large download (~20GB)
- Requires virtualization software
- VM expires after 90 days (but can re-download)
- Resource intensive

## Option 3: Docker Windows Containers (Advanced)

⚠️ **Not recommended** - Complex setup, limited benefits for this use case.

Windows containers require:
- Docker Desktop with Windows containers enabled
- Windows host OR Windows Server VM
- Significantly more complex than GitHub Actions

**Skip this option** unless you have specific requirements for local containerized Windows testing.

## Option 4: PowerShell Core Testing (Partial)

You can test **non-Windows-specific parts** of PowerShell scripts on macOS/Linux using PowerShell 7.

### Install PowerShell 7

**macOS:**
```bash
brew install --cask powershell
```

**Linux (Ubuntu/Debian):**
```bash
wget -q https://packages.microsoft.com/config/ubuntu/22.04/packages-microsoft-prod.deb
sudo dpkg -i packages-microsoft-prod.deb
sudo apt-get update
sudo apt-get install -y powershell
```

### What You Can Test

✅ **Works on macOS/Linux:**
- PowerShell syntax validation
- Function logic (non-Windows-specific)
- String manipulation
- Basic cmdlets (Get-Command, Test-Path, etc.)

❌ **Won't work on macOS/Linux:**
- Windows Registry operations (`Get-ItemProperty HKCU:\...`)
- Windows Forms (GUI dialogs)
- Windows-specific paths (`$Env:SystemRoot\system32\...`)
- `node.exe` downloads (Windows binaries)
- `setx.exe` command

### Syntax Check Example

```bash
# Check PowerShell syntax without running
pwsh -NoProfile -Command "Get-Command -Syntax .\install.ps1"

# Parse the file for syntax errors
pwsh -NoProfile -Command "
  \$errors = \$null
  \$null = [System.Management.Automation.PSParser]::Tokenize((Get-Content install.ps1 -Raw), [ref]\$errors)
  if (\$errors) { \$errors; exit 1 } else { Write-Host 'No syntax errors' }
"
```

## Recommended Workflow

For most development scenarios:

### 1. During Development (macOS/Linux)
```bash
# Quick syntax check
pwsh -NoProfile -Command "Test-Path install.ps1"

# Make your changes
vim install.ps1

# Commit and push
git add install.ps1
git commit -m "Update Windows installer"
git push
```

### 2. Automated Testing (GitHub Actions)
- Push triggers the workflow
- Wait ~5 minutes for Windows test to complete
- Check the Actions tab for results

### 3. Final Manual Testing (If Needed)
- Use Windows VM for interactive testing
- Test GUI dialogs
- Verify registry changes
- Test real user workflow

## Debugging Failed CI Tests

If the GitHub Actions Windows test fails:

### 1. Check the Logs

```bash
# View workflow runs
gh run list --workflow=test.yml

# View specific run
gh run view <run-id> --log
```

### 2. Add Debug Output

Add debugging to `install.ps1`:

```powershell
# Add before problematic section
Write-Host "DEBUG: NVM_HOME = $NVM_HOME"
Write-Host "DEBUG: Current directory: $(Get-Location)"
Write-Host "DEBUG: Files in current dir:"
Get-ChildItem | Format-Table Name, Length
```

### 3. Re-run the Workflow

```bash
git commit --amend --no-edit
git push --force-with-lease
```

## Testing Checklist

Before releasing changes to `install.ps1`:

- [ ] Syntax is valid (PowerShell 7 on macOS/Linux)
- [ ] GitHub Actions Windows test passes
- [ ] Manual test in Windows VM (for major changes)
- [ ] No hardcoded paths
- [ ] Error handling works
- [ ] Registry changes are correct
- [ ] Downloads work (Node.js, universal-nvm)
- [ ] `nvm.ps1` command functions after install

## Tips

### Fast Iteration

To quickly test changes without waiting for full CI:

1. Create a minimal test in the workflow:
```yaml
- name: Quick syntax test
  run: pwsh -NoProfile -Command "& {.\install.ps1 -nvmhome test123 -nvmlink test456; exit 0}"
```

2. Comment out slow parts temporarily:
```powershell
# Write-Output "Retrieving $nodejsBinUrl"
# Invoke-WebRequest $nodejsBinUrl -OutFile $destZipFile
```

### Local PowerShell Testing

Create a test wrapper on macOS/Linux:

```powershell
# test-install-syntax.ps1
$errors = $null
$null = [System.Management.Automation.PSParser]::Tokenize(
    (Get-Content install.ps1 -Raw),
    [ref]$errors
)

if ($errors) {
    Write-Host "Syntax errors found:" -ForegroundColor Red
    $errors | ForEach-Object {
        Write-Host "  Line $($_.Token.StartLine): $($_.Message)" -ForegroundColor Red
    }
    exit 1
} else {
    Write-Host "✓ No syntax errors" -ForegroundColor Green
}

# Check for common issues
$content = Get-Content install.ps1 -Raw

if ($content -match '\$Env:TEMP(?!\\)') {
    Write-Warning "Found \$Env:TEMP without backslash - might need \$Env:TEMP\file.txt"
}

if ($content -match 'HKCU:' -and $IsLinux) {
    Write-Host "Note: Registry operations won't work on Linux (expected)" -ForegroundColor Yellow
}

Write-Host "✓ Basic checks passed" -ForegroundColor Green
```

Run it:
```bash
pwsh ./test-install-syntax.ps1
```

## Summary

**Best approach for most developers:**
1. ✅ Use GitHub Actions for automated testing (zero setup)
2. ✅ Use PowerShell 7 on macOS/Linux for syntax checking
3. ✅ Use Windows VM only for final manual testing or debugging complex issues

This gives you 95% confidence without needing a Windows machine for day-to-day development.
