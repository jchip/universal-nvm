#!/usr/bin/env bash

set -e

echo "Universal NVM Uninstaller"
echo "========================="
echo ""

# Detect NVM_HOME
if [ -z "${NVM_HOME}" ]; then
  NVM_HOME="$HOME/.unvm"
fi

echo "NVM_HOME: ${NVM_HOME}"
echo ""

# Function to remove NVM block from a shell profile file
remove_from_profile() {
  local profile_file="$1"
  local shell_name="$2"

  if [ ! -f "$profile_file" ]; then
    return
  fi

  local begin_bash="# NVM bash initialize BEGIN - do not modify #"
  local end_bash="# NVM bash initialize END - do not modify #"
  local begin_zsh="# NVM zsh initialize BEGIN - do not modify #"
  local end_zsh="# NVM zsh initialize END - do not modify #"

  # Create a temporary file
  local temp_file="${profile_file}.unvm_temp"

  # Check if the file contains NVM blocks
  if grep -q "# NVM.*initialize BEGIN" "$profile_file"; then
    echo "  Removing NVM configuration from: $profile_file"

    # Use awk to remove lines between BEGIN and END markers (inclusive)
    awk '
      /# NVM (bash|zsh) initialize BEGIN - do not modify #/ { skip=1; next }
      /# NVM (bash|zsh) initialize END - do not modify #/ { skip=0; next }
      !skip
    ' "$profile_file" > "$temp_file"

    # Replace original file with cleaned version
    mv "$temp_file" "$profile_file"
  fi
}

# Remove from shell configuration files
echo "Removing NVM configuration from shell profiles..."

# Bash
if [ -f "$HOME/.bashrc" ]; then
  remove_from_profile "$HOME/.bashrc" "bash"
fi

if [ -f "$HOME/.bash_profile" ]; then
  remove_from_profile "$HOME/.bash_profile" "bash"
fi

# Zsh
ZD=${HOME}
if [ -n "${ZDOTDIR}" ]; then
  ZD=${ZDOTDIR}
fi

if [ -f "${ZD}/.zshrc" ]; then
  remove_from_profile "${ZD}/.zshrc" "zsh"
fi

if [ -f "${ZD}/.zshenv" ]; then
  remove_from_profile "${ZD}/.zshenv" "zsh"
fi

echo ""

# Detect OS
OS_TYPE="$(uname)"

if [ "$OS_TYPE" = "Darwin" ]; then
  # macOS: Remove LaunchAgent
  LAUNCH_AGENT="$HOME/Library/LaunchAgents/com.universal-nvm.plist"

  if [ -f "$LAUNCH_AGENT" ]; then
    echo "Removing macOS LaunchAgent..."
    echo "  Unloading: $LAUNCH_AGENT"
    launchctl unload "$LAUNCH_AGENT" 2>/dev/null || true
    echo "  Deleting: $LAUNCH_AGENT"
    rm -f "$LAUNCH_AGENT"
  fi
  echo ""

elif [ "$OS_TYPE" = "Linux" ]; then
  # Linux: Remove systemd environment.d file
  ENV_FILE="$HOME/.config/environment.d/10-universal-nvm.conf"

  if [ -f "$ENV_FILE" ]; then
    echo "Removing Linux environment configuration..."
    echo "  Deleting: $ENV_FILE"
    rm -f "$ENV_FILE"
  fi
  echo ""
fi

# Remove NVM_HOME directory
if [ -d "${NVM_HOME}" ]; then
  echo "Removing NVM installation directory..."
  echo "  Deleting: ${NVM_HOME}"
  rm -rf "${NVM_HOME}"
  echo ""
fi

echo "✓ Universal NVM has been uninstalled"
echo ""
echo "To complete the uninstallation:"
echo "  1. Close and reopen your terminal windows"
echo "  2. Log out and log back in (to clear environment variables)"
echo ""
echo "Note: Any Node.js versions installed in ${NVM_HOME} have been removed."
