$Env:NVM_POWERSHELL = "true"
$Env:NVM_PSPROFILE = "$PROFILE"
$Env:NVM_RUN_ID = "$PID"

Try {
  $NODE_EXE = "$PSScriptRoot\..\node.exe"
  if ( -not (Test-Path $NODE_EXE)) {
    $NODE_EXE = node
  }

  $NVM_JS = "$PSScriptRoot\..\dist\nvm.js"

  & $NODE_EXE $NVM_JS $args
}
Finally {
  Remove-Item Env:\NVM_POWERSHELL
  Remove-Item Env:\NVM_RUN_ID
}

$nvmEnv = "$Env:TMP\nvm_env$PID.ps1"

if ( Test-Path $nvmEnv ) {
  & $nvmEnv
  Remove-Item -Path $nvmEnv
}

if ( Test-Path Env:NVM_INSTALL ) {
  $version = "$Env:NVM_INSTALL"
  Remove-Item Env:NVM_INSTALL
  $postInstall = "$Env:NVM_HOME\post-install.ps1"
  if ( Test-Path $postInstall ) {
    powershell.exe $postInstall $version
  }
}
