#!/bin/bash
set -e

echo "========================================="
echo "Real Installation Test (Clean System)"
echo "========================================="
echo ""
echo "This test simulates: curl -fsSL install.sh | bash"
echo ""

# We need Python for the HTTP server, but it's not in the base image
# So we'll use a simpler approach: just override the URL to point to the local file
export NVM_TGZ_URL="file:///tmp/universal-nvm-local.tgz"
export NVM_TEST="1"
# Disable SSL verification in Node.js to avoid certificate issues in containers
export NODE_TLS_REJECT_UNAUTHORIZED="0"

# Clear any cached nvm tarball to ensure we use the fresh one
rm -rf "$HOME/.unvm/cache/nvm-"* 2>/dev/null || true

echo "Running install.sh..."
echo "This will:"
echo "  1. Download Node.js from nodejs.org"
echo "  2. Install universal-nvm from local tarball"
echo "  3. Set up shell environment"
echo ""

# Copy test.sh to current directory so install.sh can find it
cp /tmp/test.sh ./test.sh

# Run the install script
bash /tmp/install.sh

echo ""
echo "========================================="
echo "Installation Complete!"
echo "========================================="
echo ""

# Set up PowerShell profile
echo "Setting up PowerShell profile..."
mkdir -p "$HOME/.config/powershell"
cat > "$HOME/.config/powershell/Microsoft.PowerShell_profile.ps1" << 'PWSH_PROFILE'
# Set up Universal NVM for PowerShell on Linux
$Env:NVM_HOME = "$HOME/.unvm"
$Env:PATH = "$Env:NVM_HOME/bin:$Env:PATH"

function nvm {
    & "$Env:NVM_HOME/bin/nvm.ps1" @args
}
PWSH_PROFILE
echo "PowerShell profile created at ~/.config/powershell/Microsoft.PowerShell_profile.ps1"
echo ""

# Now run the tests
echo "========================================="
echo "Running Usage Tests"
echo "========================================="
echo ""

# Run the test script
# The test script will manually initialize NVM
cd "$HOME"
./test-install.sh
