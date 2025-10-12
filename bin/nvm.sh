function _jchip_universal_nvm() {
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
    echo "Can't locate a default node.js executable to run nvm";
    return 1
  fi

  if [ -z "$TMPDIR" ]; then
    TMPDIR="$($NVM_NODE -e "console.log(os.tmpdir())")"
  else
    export NVM_TMPDIR=$TMPDIR
  fi

  $NVM_NODE "$NVM_HOME/dist/nvm.js" $*

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

# Create nvm function that calls the internal function
function nvm() {
  _jchip_universal_nvm "$@"
}

# If a version is linked, then automatically add it to PATH

if [ -z "$NVM_USE" ] && [ -d "$NVM_LINK" ] && [ -x "$NVM_LINK/node" ]; then
  export PATH="$NVM_LINK:$PATH"
fi
