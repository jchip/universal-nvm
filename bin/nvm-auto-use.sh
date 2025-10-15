#!/usr/bin/env bash

# Universal NVM auto-use hook
# This script provides automatic Node.js version switching when changing directories
#
# To enable, add one of the following to your shell profile:
#
# For Bash (~/.bashrc or ~/.bash_profile):
#   source "$NVM_HOME/bin/nvm-auto-use.sh"
#   nvm_enable_auto_use
#
# For Zsh (~/.zshrc):
#   source "$NVM_HOME/bin/nvm-auto-use.sh"
#   nvm_enable_auto_use

# Track last directory to detect changes (for Bash PROMPT_COMMAND)
_NVM_LAST_DIR=""

# The actual auto-use function
_nvm_auto_use() {
  # For Bash with PROMPT_COMMAND, only run if directory changed
  if [ -n "$BASH_VERSION" ]; then
    local current_dir="$PWD"
    if [ "$_NVM_LAST_DIR" = "$current_dir" ]; then
      return
    fi
    _NVM_LAST_DIR="$current_dir"
  fi

  # Run nvm auto-use, which checks for .nvmrc, .node-version, or package.json
  # Shows message when switching versions
  # Use --silent to suppress "no version file found" message
  if type _jchip_universal_nvm >/dev/null 2>&1; then
    _jchip_universal_nvm auto-use --silent
  fi
}

# Enable auto-use for Bash
_nvm_enable_auto_use_bash() {
  # Check if already enabled
  if [[ "$PROMPT_COMMAND" == *"_nvm_auto_use"* ]]; then
    echo "NVM auto-use is already enabled for Bash"
    return 0
  fi

  # Add to PROMPT_COMMAND
  if [ -z "$PROMPT_COMMAND" ]; then
    export PROMPT_COMMAND="_nvm_auto_use"
  else
    export PROMPT_COMMAND="_nvm_auto_use; $PROMPT_COMMAND"
  fi

  echo "NVM auto-use enabled for Bash"
  echo "Node.js version will automatically switch when you cd into directories with .nvmrc, .node-version, or package.json"
}

# Enable auto-use for Zsh
_nvm_enable_auto_use_zsh() {
  # Check if already enabled
  if [[ " ${chpwd_functions[*]} " == *" _nvm_auto_use "* ]]; then
    echo "NVM auto-use is already enabled for Zsh"
    return 0
  fi

  # Add to chpwd_functions array
  if ! typeset -p chpwd_functions >/dev/null 2>&1; then
    chpwd_functions=()
  fi
  chpwd_functions+=(_nvm_auto_use)

  echo "NVM auto-use enabled for Zsh"
  echo "Node.js version will automatically switch when you cd into directories with .nvmrc, .node-version, or package.json"
}

# Disable auto-use for Bash
_nvm_disable_auto_use_bash() {
  if [[ "$PROMPT_COMMAND" != *"_nvm_auto_use"* ]]; then
    echo "NVM auto-use is not enabled for Bash"
    return 0
  fi

  # Remove from PROMPT_COMMAND
  export PROMPT_COMMAND="${PROMPT_COMMAND//_nvm_auto_use; /}"
  export PROMPT_COMMAND="${PROMPT_COMMAND//_nvm_auto_use/}"

  echo "NVM auto-use disabled for Bash"
}

# Disable auto-use for Zsh
_nvm_disable_auto_use_zsh() {
  if [[ " ${chpwd_functions[*]} " != *" _nvm_auto_use "* ]]; then
    echo "NVM auto-use is not enabled for Zsh"
    return 0
  fi

  # Remove from chpwd_functions array
  chpwd_functions=("${(@)chpwd_functions:#_nvm_auto_use}")

  echo "NVM auto-use disabled for Zsh"
}

# Enable auto-use for Bash using cd wrapper
_nvm_enable_auto_use_bash_cd() {
  # Check if already enabled
  if type cd | grep -q "_nvm_auto_use"; then
    echo "NVM auto-use (cd wrapper) is already enabled for Bash"
    return 0
  fi

  # Create cd wrapper
  eval 'cd() { builtin cd "$@" && _nvm_auto_use; }'
  eval 'pushd() { builtin pushd "$@" && _nvm_auto_use; }'
  eval 'popd() { builtin popd "$@" && _nvm_auto_use; }'

  echo "NVM auto-use enabled for Bash (cd wrapper mode)"
  echo "Node.js version will automatically switch when you cd into directories with .nvmrc, .node-version, or package.json"
}

# Disable auto-use for Bash cd wrapper
_nvm_disable_auto_use_bash_cd() {
  if ! type cd | grep -q "_nvm_auto_use"; then
    echo "NVM auto-use (cd wrapper) is not enabled for Bash"
    return 0
  fi

  # Remove the wrappers by unsetting them
  unset -f cd pushd popd 2>/dev/null

  echo "NVM auto-use disabled for Bash (cd wrapper mode)"
}

# User-facing enable function (detects shell automatically)
# Usage: nvm_enable_auto_use [--cd]
#   --cd: Use cd wrapper mode (Bash only, more efficient)
#   (default): Use prompt-based mode (catches all directory changes)
nvm_enable_auto_use() {
  local use_cd_wrapper=false

  # Check for --cd flag
  if [ "$1" = "--cd" ]; then
    use_cd_wrapper=true
  fi

  if [ -n "$ZSH_VERSION" ]; then
    # Zsh always uses chpwd_functions (already perfect)
    _nvm_enable_auto_use_zsh
  elif [ -n "$BASH_VERSION" ]; then
    if [ "$use_cd_wrapper" = true ]; then
      _nvm_enable_auto_use_bash_cd
    else
      _nvm_enable_auto_use_bash
    fi
  else
    echo "Warning: Shell detection failed. Are you using Bash or Zsh?"
    echo "Your shell: $SHELL"
    return 1
  fi
}

# User-facing disable function (detects shell automatically)
# Usage: nvm_disable_auto_use [--cd]
#   --cd: Disable cd wrapper mode (Bash only)
#   (default): Disable prompt-based mode
nvm_disable_auto_use() {
  local use_cd_wrapper=false

  # Check for --cd flag
  if [ "$1" = "--cd" ]; then
    use_cd_wrapper=true
  fi

  if [ -n "$ZSH_VERSION" ]; then
    _nvm_disable_auto_use_zsh
  elif [ -n "$BASH_VERSION" ]; then
    if [ "$use_cd_wrapper" = true ]; then
      _nvm_disable_auto_use_bash_cd
    else
      _nvm_disable_auto_use_bash
    fi
  else
    echo "Warning: Shell detection failed. Are you using Bash or Zsh?"
    echo "Your shell: $SHELL"
    return 1
  fi
}

# Export the functions so they're available in the shell
export -f _nvm_auto_use 2>/dev/null || true
export -f nvm_enable_auto_use 2>/dev/null || true
export -f nvm_disable_auto_use 2>/dev/null || true
