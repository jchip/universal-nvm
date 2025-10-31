# Docker-based Installation Testing

This directory contains Docker-based testing infrastructure for universal-nvm. Unlike the unit/integration tests, these tests verify the actual installation process and real-world usage on a clean Linux system.

## What This Tests

- ✅ Real installation from npm tarball (simulates `npm install -g universal-nvm`)
- ✅ Shell integration (bash, zsh, and PowerShell environment setup)
- ✅ `nvm install lts` - Download and install LTS Node.js
- ✅ `nvm install <version>` - Install specific versions
- ✅ `nvm use <version>` - Switch between versions
- ✅ `nvm link latest` - Link to latest version (new feature)
- ✅ `nvm link <version>` - Link to specific version
- ✅ `nvm unlink` - Unlink default version
- ✅ Node.js and npm execution
- ✅ Bash initialization (.bashrc)
- ✅ Zsh initialization (.zshrc and .zshenv)
- ✅ PowerShell 7 on Linux
  - Profile setup and nvm function
  - nvm commands execution
  - Node.js version switching
  - Post-uninstall state verification
- ✅ Uninstall script - Complete removal verification
  - Removes ~/.unvm directory
  - Cleans shell configuration files (bash/zsh)
  - Removes environment.d files
  - Verifies nvm command is no longer available
  - PowerShell profile cleanup (manual, as documented)
- ✅ Clean Ubuntu 22.04 environment

## Prerequisites

- Docker installed and running
- Project built and ready (`dist/unvm.js` exists)

## GitHub Actions Integration

These Docker tests run automatically in GitHub Actions CI/CD on every push and pull request. The workflow:

1. Builds the project
2. Creates an npm tarball
3. Builds the Docker test image (automatically detects x64/arm64 architecture)
4. Runs all 31 integration tests (bash, zsh, PowerShell, uninstall)

View the workflow at: `.github/workflows/test.yml` (job: `docker-integration-tests`)

**Architecture Support:**
- The Dockerfile automatically detects the system architecture
- Downloads the correct PowerShell build (x64 for GitHub Actions, arm64 for Apple Silicon)
- Works on both `ubuntu-latest` (x64) runners and local ARM64 development machines

## Quick Start

### 1. Build the Project

```bash
# From project root
./node_modules/.bin/webpack
```

### 2. Package the Build

```bash
# From project root
npm pack
```

This creates a tarball like `universal-nvm-1.10.1.tgz` containing the build artifacts.

### 3. Build Docker Image

```bash
# From project root
docker build -f test/docker/Dockerfile -t unvm-install-test .
```

### 4. Run Tests

```bash
docker run --rm unvm-install-test
```

Expected output:
```
=========================================
Universal NVM Installation & Usage Test
=========================================

Testing: Install LTS version
✓ PASSED

Testing: Verify Node.js execution
✓ PASSED

...

Tests Passed: 31
Tests Failed: 0

All tests passed! ✓
```

The test suite includes:
- 12 bash functionality tests
- 4 zsh integration tests
- 4 PowerShell integration tests
- 11 uninstall verification tests (including PowerShell cleanup)

## Usage Scenarios

### Run All Tests (default)

```bash
docker run --rm unvm-install-test
```

### Interactive Testing

Start a bash shell inside the container to manually test commands:

```bash
docker run --rm -it unvm-install-test bash

# Inside container:
source ~/.bashrc
nvm install lts
nvm install 20
nvm use 20
node --version
```

### Debugging Failed Tests

```bash
# Run with verbose output
docker run --rm -it unvm-install-test bash

# Inside container, run tests manually:
source ~/.bashrc
./test-install.sh
```

### Multi-Platform Support

The Docker setup works on both x86_64 and arm64 (Apple Silicon) systems. The `install.sh` script automatically detects the architecture and downloads the correct Node.js binaries.

### Rebuild After Changes

```bash
# 1. Rebuild the project
./node_modules/.bin/webpack

# 2. Repackage
npm pack

# 3. Rebuild Docker image (use --no-cache to force rebuild)
docker build --no-cache -f test/docker/Dockerfile -t unvm-install-test .

# 4. Run tests
docker run --rm unvm-install-test
```

## Files

- **`Dockerfile`** - Ubuntu 22.04-based test environment
- **`test-install.sh`** - Automated test script that runs inside the container
- **`README.md`** - This file
- **`/.dockerignore`** - Docker ignore file (at project root)

## How It Works

1. **Package Creation**: `npm pack` creates a tarball with:
   - `dist/unvm.js` - Bundled CLI
   - `bin/` - Shell scripts
   - `install.sh` - Installation script
   - `package.json` - Package metadata

2. **Container Setup**:
   - Starts with clean Ubuntu 22.04
   - Installs prerequisites (curl, bash, tar)
   - Creates a test user (simulates real user environment)
   - Extracts the tarball to `~/.unvm`
   - Sets up bash environment

3. **Test Execution**:
   - Sources `nvm.sh` in bash
   - Runs automated tests via `test-install.sh`
   - Verifies installation, usage, and new features

4. **Exit Code**:
   - `0` - All tests passed
   - `1` - One or more tests failed

## Troubleshooting

### "Error: Cannot find module" when building

```bash
# Install dependencies first
fyn install
```

### "No such file: universal-nvm-*.tgz"

```bash
# Run npm pack before building Docker image
npm pack
```

### Docker build fails with "cannot copy"

```bash
# Ensure the tarball exists at project root
ls -la universal-nvm-*.tgz

# Rebuild with no cache
docker build --no-cache -f test/docker/Dockerfile -t unvm-install-test .
```

### Tests timeout downloading Node.js

The tests download real Node.js versions from nodejs.org. This can take a few minutes depending on your network speed. The download happens inside the container during test execution.

```bash
# Check Docker network connectivity
docker run --rm ubuntu:22.04 curl -I https://nodejs.org/dist/
```

### "nvm: command not found" inside container

```bash
# Make sure to source the profile
docker run --rm -it unvm-install-test bash
source ~/.bashrc
nvm --version
```

## Future Enhancements

Potential improvements for this testing infrastructure:

- [ ] Test on multiple Linux distributions (Alpine, Debian, CentOS)
- [ ] Test the `install.sh` script directly (not just tarball extraction)
- [ ] Add performance benchmarks
- [ ] Cache Node.js downloads to speed up tests
- [x] Integrate with CI/CD (GitHub Actions) ✅
- [ ] Test Windows Server containers (for PowerShell on Windows)
- [ ] Add ARM64 runner tests (currently runs on x64 in CI)

## Notes

- This testing approach complements but doesn't replace the unit/E2E tests
- Tests are designed to run quickly by only installing a few Node.js versions
- The container uses a non-root user to simulate a real user environment
- Network access is required for downloading Node.js versions
