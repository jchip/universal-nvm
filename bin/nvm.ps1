$Env:NVM_POWERSHELL = "true"
$Env:NVM_PSPROFILE = "$PROFILE"
$Env:NVM_RUN_ID = "$PID"

Try {
  # Detect platform - on Windows use node.exe, on Unix use node
  $IsUnix = $PSVersionTable.PSVersion.Major -ge 6 -and ($IsLinux -or $IsMacOS)

  if ($IsUnix) {
    # On Unix (macOS/Linux), look for node in $NVM_HOME/nodejs/bin or fall back to system node
    $NODE_EXE = "$PSScriptRoot/../nodejs/bin/node"
    if ( -not (Test-Path $NODE_EXE)) {
      $NODE_EXE = "node"
    }
    $NVM_JS = "$PSScriptRoot/../dist/nvm.js"
  } else {
    # On Windows, look for node.exe in parent directory or fall back to system node
    $NODE_EXE = "$PSScriptRoot\..\node.exe"
    if ( -not (Test-Path $NODE_EXE)) {
      $NODE_EXE = "node"
    }
    $NVM_JS = "$PSScriptRoot\..\dist\nvm.js"
  }

  & $NODE_EXE $NVM_JS --shell=powershell $args
}
Finally {
  Remove-Item Env:\NVM_POWERSHELL
  Remove-Item Env:\NVM_RUN_ID
}

# Determine temp directory and path separator based on platform
if ($IsUnix) {
  $tempDir = if ($Env:TMPDIR) { $Env:TMPDIR } else { "/tmp" }
  $nvmEnv = "$tempDir/nvm_env$PID.ps1"
} else {
  $nvmEnv = "$Env:TMP\nvm_env$PID.ps1"
}

if ( Test-Path $nvmEnv ) {
  & $nvmEnv
  Remove-Item -Path $nvmEnv
}

if ( Test-Path Env:NVM_INSTALL ) {
  $version = "$Env:NVM_INSTALL"
  Remove-Item Env:NVM_INSTALL

  if ($IsUnix) {
    $postInstall = "$Env:NVM_HOME/post-install.ps1"
  } else {
    $postInstall = "$Env:NVM_HOME\post-install.ps1"
  }

  if ( Test-Path $postInstall ) {
    if ($IsUnix) {
      pwsh $postInstall $version
    } else {
      powershell.exe $postInstall $version
    }
  }
}
