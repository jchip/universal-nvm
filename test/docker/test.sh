# Test hook for install.sh
# This file is sourced by install.sh when it exists
# It allows us to customize the installation for testing

# Skip Node.js download since we already have it
echo "Skipping Node.js download (already installed)"

# Just install universal-nvm
installNvm
