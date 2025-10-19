# Universal NVM auto-use hook for PowerShell
# This script provides automatic Node.js version switching when changing directories
#
# Works on both Windows and Unix (macOS/Linux) with PowerShell 7+
#
# To enable, add the following to your PowerShell profile ($PROFILE):
#   $IsUnix = $PSVersionTable.PSVersion.Major -ge 6 -and ($IsLinux -or $IsMacOS)
#   $nvmAutoUsePath = if ($IsUnix) { "$Env:NVM_HOME/bin/nvm-auto-use.ps1" } else { "$Env:NVM_HOME\bin\nvm-auto-use.ps1" }
#   . $nvmAutoUsePath
#   Enable-NvmAutoUse
#
# To find your profile location, run: $PROFILE
# To create it if it doesn't exist: New-Item -Path $PROFILE -ItemType File -Force

# Detect platform
$IsUnix = $PSVersionTable.PSVersion.Major -ge 6 -and ($IsLinux -or $IsMacOS)

# Store the original prompt function
if (-not (Test-Path Function:\_NvmOriginalPrompt)) {
    if (Test-Path Function:\prompt) {
        Copy-Item Function:\prompt Function:\_NvmOriginalPrompt
    } else {
        # Default prompt if none exists
        function _NvmOriginalPrompt {
            "PS $($executionContext.SessionState.Path.CurrentLocation)$('>' * ($nestedPromptLevel + 1)) "
        }
    }
}

# Track last directory to detect changes
$global:_NvmLastDirectory = $null

# Auto-use helper function
function _Invoke-NvmAutoUse {
    # Only run if directory changed
    $currentDir = $PWD.Path
    if ($global:_NvmLastDirectory -eq $currentDir) {
        return
    }
    $global:_NvmLastDirectory = $currentDir

    # Run nvm auto-use if version files exist
    # Only runs if .nvmrc, .node-version, or package.json exists in current directory
    # Use --silent to suppress "no version file found" message

    # Construct nvm command path based on platform
    $nvmCmd = if ($IsUnix) {
        if ($Env:NVM_HOME) {
            "$Env:NVM_HOME/bin/nvm.ps1"
        } else {
            "nvm"
        }
    } else {
        "nvm"
    }

    if (Test-Path .nvmrc -PathType Leaf) {
        & $nvmCmd auto-use --silent
    } elseif (Test-Path .node-version -PathType Leaf) {
        & $nvmCmd auto-use --silent
    } elseif (Test-Path package.json -PathType Leaf) {
        & $nvmCmd auto-use --silent
    }
}

# Enhanced prompt with auto-use
function _NvmAutoUsePrompt {
    # Run auto-use first (output goes to console)
    _Invoke-NvmAutoUse | Out-Host

    # Then return the original prompt
    return _NvmOriginalPrompt
}

# Enable auto-use
function Enable-NvmAutoUse {
    param(
        [switch]$Quiet
    )

    if (Test-Path Function:\prompt) {
        $currentPrompt = Get-Content Function:\prompt
        if ($currentPrompt -like "*_Invoke-NvmAutoUse*") {
            if (-not $Quiet) {
                Write-Host "NVM auto-use is already enabled" -ForegroundColor Yellow
            }
            return
        }
    }

    # Replace the prompt function
    Copy-Item Function:\_NvmAutoUsePrompt Function:\prompt -Force

    if (-not $Quiet) {
        Write-Host "NVM auto-use enabled" -ForegroundColor Green
        Write-Host "Node.js version will automatically switch when you cd into directories with .nvmrc, .node-version, or package.json" -ForegroundColor Gray
    }
}

# Disable auto-use
function Disable-NvmAutoUse {
    if (Test-Path Function:\prompt) {
        $currentPrompt = Get-Content Function:\prompt
        if ($currentPrompt -notlike "*_Invoke-NvmAutoUse*") {
            Write-Host "NVM auto-use is not enabled" -ForegroundColor Yellow
            return
        }
    }

    # Restore the original prompt
    Copy-Item Function:\_NvmOriginalPrompt Function:\prompt -Force

    Write-Host "NVM auto-use disabled" -ForegroundColor Green
}

# Store original Set-Location if not already stored
if (-not (Test-Path Function:\_NvmOriginalSetLocation)) {
    if (Test-Path Function:\Set-Location) {
        Copy-Item Function:\Set-Location Function:\_NvmOriginalSetLocation
    }
}

# cd wrapper function
function _NvmCdWrapper {
    param([Parameter(ValueFromRemainingArguments=$true)]$Path)

    # Call original Set-Location
    if ($Path) {
        _NvmOriginalSetLocation @Path
    } else {
        _NvmOriginalSetLocation
    }

    # Run auto-use if successful
    if ($?) {
        # Construct nvm command path based on platform
        $nvmCmd = if ($IsUnix) {
            if ($Env:NVM_HOME) {
                "$Env:NVM_HOME/bin/nvm.ps1"
            } else {
                "nvm"
            }
        } else {
            "nvm"
        }

        if (Test-Path .nvmrc -PathType Leaf) {
            & $nvmCmd auto-use --silent
        } elseif (Test-Path .node-version -PathType Leaf) {
            & $nvmCmd auto-use --silent
        } elseif (Test-Path package.json -PathType Leaf) {
            & $nvmCmd auto-use --silent
        }
    }
}

# Enable auto-use with cd wrapper mode
function Enable-NvmAutoUseCdWrapper {
    param([switch]$Quiet)

    # Check if already enabled
    if ((Test-Path Function:\Set-Location) -and (Get-Content Function:\Set-Location) -like "*_NvmCdWrapper*") {
        if (-not $Quiet) {
            Write-Host "NVM auto-use (cd wrapper) is already enabled" -ForegroundColor Yellow
        }
        return
    }

    # Create a function that shadows the Set-Location cmdlet
    function global:Set-Location {
        param([Parameter(ValueFromRemainingArguments=$true)]$Path)

        # Call the original cmdlet
        if ($Path) {
            Microsoft.PowerShell.Management\Set-Location @Path
        } else {
            Microsoft.PowerShell.Management\Set-Location
        }

        # Run auto-use if successful
        if ($?) {
            # Construct nvm command path based on platform
            $IsUnix = $PSVersionTable.PSVersion.Major -ge 6 -and ($IsLinux -or $IsMacOS)
            $nvmCmd = if ($IsUnix) {
                if ($Env:NVM_HOME) {
                    "$Env:NVM_HOME/bin/nvm.ps1"
                } else {
                    "nvm"
                }
            } else {
                "nvm"
            }

            if (Test-Path .nvmrc -PathType Leaf) {
                & $nvmCmd auto-use --silent
            } elseif (Test-Path .node-version -PathType Leaf) {
                & $nvmCmd auto-use --silent
            } elseif (Test-Path package.json -PathType Leaf) {
                & $nvmCmd auto-use --silent
            }
        }
    }

    Set-Alias -Name cd -Value Set-Location -Option AllScope -Force

    if (-not $Quiet) {
        Write-Host "NVM auto-use enabled (cd wrapper mode)" -ForegroundColor Green
        Write-Host "Node.js version will automatically switch when you cd into directories with .nvmrc, .node-version, or package.json" -ForegroundColor Gray
    }
}

# Disable auto-use cd wrapper mode
function Disable-NvmAutoUseCdWrapper {
    if (-not (Test-Path Function:\Set-Location)) {
        Write-Host "NVM auto-use (cd wrapper) is not enabled" -ForegroundColor Yellow
        return
    }

    # Remove the Set-Location function to restore the cmdlet
    Remove-Item Function:\Set-Location -Force
    Set-Alias -Name cd -Value Set-Location -Option AllScope -Force

    Write-Host "NVM auto-use disabled (cd wrapper mode)" -ForegroundColor Green
}
