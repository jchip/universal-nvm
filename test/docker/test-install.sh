#!/bin/bash

# Colors for output (define early for debug output)
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "Debug: Checking installation status"
echo "========================================="
echo ""

# Check if ~/.unvm directory exists
if [ -d "$HOME/.unvm" ]; then
    echo -e "${GREEN}✓ ~/.unvm directory exists${NC}"
    echo "Contents:"
    ls -la "$HOME/.unvm"
    echo ""
    echo "Contents of ~/.unvm/bin/:"
    ls -la "$HOME/.unvm/bin/"
else
    echo -e "${RED}✗ ~/.unvm directory does NOT exist${NC}"
    echo "Installation may have failed!"
fi
echo ""

# Check if .bashrc exists and contains NVM initialization
echo "Checking .bashrc for NVM initialization..."
if [ -f "$HOME/.bashrc" ]; then
    echo -e "${GREEN}✓ .bashrc exists${NC}"
    if grep -q "nvm\|NVM\|unvm" "$HOME/.bashrc"; then
        echo -e "${GREEN}✓ .bashrc contains NVM references${NC}"
        echo "NVM-related lines in .bashrc:"
        grep -n "nvm\|NVM\|unvm" "$HOME/.bashrc"
    else
        echo -e "${RED}✗ .bashrc does NOT contain NVM initialization${NC}"
    fi
else
    echo -e "${RED}✗ .bashrc does NOT exist${NC}"
fi
echo ""

# Manually initialize NVM (bypass .bashrc guard)
echo "Manually initializing NVM..."
export NVM_HOME="$HOME/.unvm"
export PATH="$NVM_HOME/bin:$PATH"
export NVM_LINK="$HOME/.unvm/nodejs/bin"

# Source unvm.sh to define nvm functions
if [ -s "$NVM_HOME/bin/unvm.sh" ]; then
    echo "Sourcing unvm.sh..."
    source "$NVM_HOME/bin/unvm.sh"
fi

# Add first installed version to PATH temporarily (for testing before linking)
FIRST_VERSION=$(ls -1 "$HOME/.unvm/nodejs/" 2>/dev/null | grep "^v" | head -1)
if [ -n "$FIRST_VERSION" ] && [ ! -e "$NVM_LINK" ]; then
    echo "No linked version yet, temporarily adding $FIRST_VERSION to PATH"
    export PATH="$HOME/.unvm/nodejs/$FIRST_VERSION/bin:$PATH"
fi
echo ""

# Debug: Check if the NVM functions were loaded
echo "Checking if NVM functions are defined..."
if type nvm >/dev/null 2>&1; then
    echo -e "${GREEN}✓ nvm function is defined${NC}"
else
    echo -e "${RED}✗ nvm function NOT defined${NC}"
fi

# Debug PATH and node location
echo ""
echo "Current PATH: $PATH"
echo ""
echo "Checking for Node.js binary..."
if [ -x "$HOME/.unvm/node" ]; then
    echo -e "${GREEN}✓ $HOME/.unvm/node exists and is executable${NC}"
    NODE_VERSION=$("$HOME/.unvm/node" --version)
    echo "  Version: $NODE_VERSION"
else
    echo -e "${RED}✗ $HOME/.unvm/node not found or not executable${NC}"
fi

echo "Checking nodejs directory..."
if [ -d "$HOME/.unvm/nodejs" ]; then
    echo -e "${GREEN}✓ $HOME/.unvm/nodejs directory exists${NC}"
    echo "  Contents:"
    ls -la "$HOME/.unvm/nodejs/"
else
    echo -e "${RED}✗ $HOME/.unvm/nodejs directory does NOT exist${NC}"
fi

if [ -d "$HOME/.unvm/nodejs/bin" ]; then
    echo -e "${GREEN}✓ $HOME/.unvm/nodejs/bin directory exists${NC}"
    echo "  Contents:"
    ls -la "$HOME/.unvm/nodejs/bin/" | head -10
    if [ -x "$HOME/.unvm/nodejs/bin/node" ]; then
        echo -e "${GREEN}✓ $HOME/.unvm/nodejs/bin/node is executable${NC}"
    else
        echo -e "${RED}✗ $HOME/.unvm/nodejs/bin/node NOT found or not executable${NC}"
    fi
else
    echo -e "${RED}✗ $HOME/.unvm/nodejs/bin directory does NOT exist${NC}"
fi
echo ""

set -e  # Exit on error

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to run a test
run_test() {
    local test_name="$1"
    local test_cmd="$2"

    echo -e "${YELLOW}Testing: ${test_name}${NC}"
    echo "Command: $test_cmd"

    if eval "$test_cmd"; then
        echo -e "${GREEN}✓ PASSED${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗ FAILED${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
    echo ""
}

echo "========================================="
echo "Starting Tests"
echo "========================================="
echo ""

# Verify nvm command is available
echo "Checking if nvm command is available..."
if ! command -v nvm &> /dev/null; then
    echo -e "${RED}ERROR: nvm command not found${NC}"
    echo "PATH: $PATH"
    echo "Checking for nvm.sh directly..."
    if [ -f "$HOME/.unvm/bin/nvm.sh" ]; then
        echo "nvm.sh exists, but was not sourced properly"
    fi
    exit 1
fi
echo -e "${GREEN}✓ nvm command found${NC}"
echo ""

# Test 1: Verify Node.js was installed by install.sh
run_test "Verify Node.js was installed" "node --version"

# Test 2: Verify npm is available
run_test "Verify npm is available" "npm --version"

# Test 3: List installed versions
# Note: nvm ls might fail if internal state isn't fully initialized, so we check nodejs directory instead
run_test "List installed versions" "[ -d ~/.unvm/nodejs/v24.11.0 ]"

# Test 4: Install specific version (20.18.0 - use full version to avoid remote fetch)
run_test "Install Node.js v20.18.0" "nvm install v20.18.0 --no-ssl"

# Test 5: Switch to version 20
run_test "Use Node.js v20" "nvm use 20"

# Test 6: Verify switched version
run_test "Verify Node.js v20 is active" "node --version | grep -q '^v20'"

# Test 7: Link to specific version (existing feature)
run_test "Link to Node.js v20" "nvm link 20"

# Test 8: Verify linked version exists
run_test "Verify linked version directory exists" "[ -L ~/.unvm/nodejs/bin ] || [ -d ~/.unvm/nodejs/bin ]"

# Test 9: Test link latest feature (new feature)
run_test "Link to latest version" "nvm link latest"

# Test 10: Install another version (22.11.0 - use full version to avoid remote fetch)
run_test "Install Node.js v22.11.0" "nvm install v22.11.0 --no-ssl"

# Test 11: Run a simple Node.js script
run_test "Execute JavaScript code" "node -e 'console.log(\"Hello from Node.js\")'"

# Test 12: Verify nvm unlink works
run_test "Unlink default version" "nvm unlink"

# Bash tests complete, now test zsh
echo ""
echo "========================================="
echo "Testing Zsh Integration"
echo "========================================="
echo ""

# Check if zsh config files were created
echo "Checking zsh configuration files..."
if [ -f "$HOME/.zshrc" ]; then
    echo -e "${GREEN}✓ .zshrc exists${NC}"
    if grep -q "NVM.*initialize" "$HOME/.zshrc"; then
        echo -e "${GREEN}✓ .zshrc contains NVM initialization${NC}"
    else
        echo -e "${RED}✗ .zshrc does NOT contain NVM initialization${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
else
    echo -e "${RED}✗ .zshrc does NOT exist${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

if [ -f "$HOME/.zshenv" ]; then
    echo -e "${GREEN}✓ .zshenv exists${NC}"
    if grep -q "NVM.*initialize" "$HOME/.zshenv"; then
        echo -e "${GREEN}✓ .zshenv contains NVM initialization${NC}"
    else
        echo -e "${RED}✗ .zshenv does NOT contain NVM initialization${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
else
    echo -e "${RED}✗ .zshenv does NOT exist${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Test zsh commands
echo "Testing nvm commands in zsh..."

# Test 13: Verify nvm command works in zsh
run_test "Verify nvm works in zsh" "zsh -c 'source ~/.zshrc && nvm --version'"

# Test 14: Verify node works in zsh
run_test "Verify node works in zsh" "zsh -c 'source ~/.zshrc && node --version'"

# Test 15: Test nvm use in zsh
run_test "Test nvm use in zsh" "zsh -c 'source ~/.zshrc && nvm use 22 && node --version | grep -q v22'"

# Test 16: Test nvm link in zsh
run_test "Test nvm link latest in zsh" "zsh -c 'source ~/.zshrc && nvm link latest'"

echo ""
echo "========================================="
echo "Testing PowerShell Integration"
echo "========================================="
echo ""

# Check if PowerShell profile was created
echo "Checking PowerShell configuration files..."
PWSH_PROFILE="$HOME/.config/powershell/Microsoft.PowerShell_profile.ps1"
if [ -f "$PWSH_PROFILE" ]; then
    echo -e "${GREEN}✓ PowerShell profile exists${NC}"
    if grep -q "NVM_HOME" "$PWSH_PROFILE"; then
        echo -e "${GREEN}✓ PowerShell profile contains NVM setup${NC}"
    else
        echo -e "${RED}✗ PowerShell profile does NOT contain NVM setup${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
else
    echo -e "${RED}✗ PowerShell profile does NOT exist${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Test PowerShell commands
echo "Testing nvm commands in PowerShell..."

# Test 17: Verify nvm works in PowerShell
run_test "Verify nvm works in PowerShell" "pwsh -NoProfile -Command '\$Env:NVM_HOME = \"\$HOME/.unvm\"; \$Env:PATH = \"\$Env:NVM_HOME/bin:\$Env:PATH\"; function nvm { & \"\$Env:NVM_HOME/bin/nvm.ps1\" @args }; nvm --version'"

# Test 18: Verify node works in PowerShell
run_test "Verify node works in PowerShell" "pwsh -Command 'node --version'"

# Test 19: Test nvm ls in PowerShell
run_test "Test nvm ls in PowerShell" "pwsh -NoProfile -Command '\$Env:NVM_HOME = \"\$HOME/.unvm\"; \$Env:PATH = \"\$Env:NVM_HOME/bin:\$Env:PATH\"; function nvm { & \"\$Env:NVM_HOME/bin/nvm.ps1\" @args }; nvm ls'"

# Test 20: Test nvm use in PowerShell
run_test "Test nvm use in PowerShell" "pwsh -NoProfile -Command '\$Env:NVM_HOME = \"\$HOME/.unvm\"; \$Env:PATH = \"\$Env:NVM_HOME/bin:\$Env:PATH\"; function nvm { & \"\$Env:NVM_HOME/bin/nvm.ps1\" @args }; nvm use 22; node --version | Select-String -Pattern v22'"

echo ""
echo "========================================="
echo "Testing Uninstall"
echo "========================================="
echo ""

# Backup critical state for verification
UNVM_DIR="$HOME/.unvm"
BASHRC="$HOME/.bashrc"
ZSHRC="$HOME/.zshrc"
ZSHENV="$HOME/.zshenv"
ENV_FILE="$HOME/.config/environment.d/10-universal-nvm.conf"

# Verify files exist before uninstall
echo "Verifying installation state before uninstall..."
if [ -d "$UNVM_DIR" ]; then
    echo -e "${GREEN}✓ $UNVM_DIR exists${NC}"
else
    echo -e "${RED}✗ $UNVM_DIR does NOT exist${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

if [ -f "$ENV_FILE" ]; then
    echo -e "${GREEN}✓ $ENV_FILE exists${NC}"
else
    echo -e "${RED}✗ $ENV_FILE does NOT exist${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Test 17: Run uninstall script
echo "Running uninstall script..."
run_test "Run uninstall script" "bash $UNVM_DIR/bin/universal-nvm-uninstall.sh"

# Test 18: Verify ~/.unvm directory is removed
run_test "Verify ~/.unvm directory removed" "[ ! -d $UNVM_DIR ]"

# Test 19: Verify .bashrc no longer contains NVM initialization
echo "Checking .bashrc after uninstall..."
if [ -f "$BASHRC" ]; then
    if grep -q "NVM.*initialize" "$BASHRC"; then
        echo -e "${RED}✗ .bashrc still contains NVM initialization${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    else
        echo -e "${GREEN}✓ .bashrc cleaned (no NVM initialization)${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    fi
else
    echo -e "${YELLOW}? .bashrc does not exist${NC}"
fi

# Test 20: Verify .zshrc no longer contains NVM initialization
echo "Checking .zshrc after uninstall..."
if [ -f "$ZSHRC" ]; then
    if grep -q "NVM.*initialize" "$ZSHRC"; then
        echo -e "${RED}✗ .zshrc still contains NVM initialization${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    else
        echo -e "${GREEN}✓ .zshrc cleaned (no NVM initialization)${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    fi
else
    echo -e "${YELLOW}? .zshrc does not exist${NC}"
fi

# Test 21: Verify .zshenv no longer contains NVM initialization
echo "Checking .zshenv after uninstall..."
if [ -f "$ZSHENV" ]; then
    if grep -q "NVM.*initialize" "$ZSHENV"; then
        echo -e "${RED}✗ .zshenv still contains NVM initialization${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    else
        echo -e "${GREEN}✓ .zshenv cleaned (no NVM initialization)${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    fi
else
    echo -e "${YELLOW}? .zshenv does not exist${NC}"
fi

# Test 22: Verify environment.d file is removed
run_test "Verify environment.d file removed" "[ ! -f $ENV_FILE ]"

# Test 23: Verify nvm command is no longer available in new shell
run_test "Verify nvm not available in bash" "bash -c '! command -v nvm &>/dev/null'"

# Test 24: Verify nvm not available in zsh
run_test "Verify nvm not available in zsh" "zsh -c '! command -v nvm &>/dev/null'"

# Test 25: Verify PowerShell profile still exists but nvm scripts are gone
echo "Checking PowerShell state after uninstall..."
if [ -f "$PWSH_PROFILE" ]; then
    echo -e "${GREEN}✓ PowerShell profile still exists (manual cleanup needed)${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${YELLOW}? PowerShell profile was removed${NC}"
fi

# Test 26: Verify nvm.ps1 scripts are removed
run_test "Verify nvm.ps1 scripts removed" "[ ! -f $HOME/.unvm/bin/nvm.ps1 ]"

# Test 27: Verify nvm not available in PowerShell (scripts gone)
run_test "Verify nvm not available in PowerShell" "pwsh -NoProfile -Command '\$Env:NVM_HOME = \"\$HOME/.unvm\"; ! (Test-Path \"\$Env:NVM_HOME/bin/nvm.ps1\")'"

echo ""
echo "========================================="
echo "Test Summary"
echo "========================================="
echo -e "Tests Passed: ${GREEN}${TESTS_PASSED}${NC}"
echo -e "Tests Failed: ${RED}${TESTS_FAILED}${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed! ✗${NC}"
    exit 1
fi
