#!/usr/bin/env bash

# nvm-setup.sh - Initialize bash profile for Git Bash on Windows
# Run this script from Git Bash after installing nvm with PowerShell

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NVM_HOME="$(dirname "$SCRIPT_DIR")"

echo "Setting up nvm for Git Bash..."
echo "NVM_HOME: $NVM_HOME"

# Find node executable
NVM_NODE="$NVM_HOME/node.exe"
if [ ! -f "$NVM_NODE" ]; then
  NVM_NODE="$NVM_HOME/node"
fi

if [ ! -f "$NVM_NODE" ]; then
  echo "Error: node executable not found"
  echo "Please run 'nvm install lts' first."
  exit 1
fi

# Determine which profile file to use
BASH_RC="$HOME/.bashrc"
BASH_PROFILE="$HOME/.bash_profile"

if [ -f "$BASH_RC" ]; then
  RCFILE="$BASH_RC"
else
  RCFILE="$BASH_PROFILE"
fi

if [ ! -f "$RCFILE" ]; then
  touch "$RCFILE"
  echo "Created $RCFILE"
fi

# Run install_bashrc.js to update the profile
echo "Updating $RCFILE..."
"$NVM_NODE" "$NVM_HOME/bin/install_bashrc.js" "$RCFILE" bash

echo ""
echo "✓ Successfully initialized nvm for Git Bash!"
echo ""
echo "To activate nvm in your current shell, run:"
echo "  source $RCFILE"
echo ""
echo "Or restart your Git Bash terminal."
