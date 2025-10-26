function _unvm_init() {
  if [ -z "$NVM_HOME" ]; then
    NVM_HOME=~/nvm
  fi

  export NVM_RUN_ID=$$

  NVM_NODE="$NVM_HOME/node"
  if [ ! -x "$NVM_NODE" ]; then
    echo "Can't find default node.js binary at ${NVM_NODE}, trying 'which node'"
    NVM_NODE=$(which node)
  fi

  if [ ! -x "$NVM_NODE" ]; then
    echo "Can't locate a default node.js executable to run unvm";
    return 1
  fi

  if [ -z "$TMPDIR" ]; then
    TMPDIR="$($NVM_NODE -e "console.log(os.tmpdir())")"
  else
    export NVM_TMPDIR=$TMPDIR
  fi

  # Detect shell type - zsh or bash
  local SHELL_TYPE="bash"
  if [ -n "$ZSH_VERSION" ]; then
    SHELL_TYPE="zsh"
  fi

  $NVM_NODE "$NVM_HOME/dist/unvm.js" --shell=$SHELL_TYPE $*

  local TMP_ENV_FILE="$TMPDIR/nvm_env${NVM_RUN_ID}.sh"

  if [ -f "$TMP_ENV_FILE" ]; then
    source "$TMP_ENV_FILE"
    rm -f "$TMP_ENV_FILE"

    local nvmInstall="$NVM_INSTALL"
    unset NVM_INSTALL

    if [ -n "$nvmInstall" ] && [ -f "$NVM_HOME/post-install.sh" ]; then
      if [ -n "$SHELL" ]; then
        $SHELL "$NVM_HOME/post-install.sh" "$nvmInstall"
      else
        bash "$NVM_HOME/post-install.sh" "$nvmInstall"
      fi
    fi
  fi

  return 0
}

# Create unvm function that calls the internal function
function unvm() {
  _unvm_init "$@"
}

# Create nvm as an alias for backward compatibility
function nvm() {
  unvm "$@"
}

# If a version is linked, then automatically add it to PATH

if [ -z "$NVM_USE" ] && [ -d "$NVM_LINK" ] && [ -x "$NVM_LINK/node" ]; then
  export PATH="$NVM_LINK:$PATH"
fi
