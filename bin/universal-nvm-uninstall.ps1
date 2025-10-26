#!/usr/bin/env pwsh

Write-Host "Universal NVM Uninstaller for Windows"
Write-Host "======================================"
Write-Host ""

# Detect NVM_HOME from environment variable or registry
$NVM_HOME = $null

if (Test-Path Env:NVM_HOME) {
    $NVM_HOME = $Env:NVM_HOME
    Write-Host "Found NVM_HOME from environment: $NVM_HOME"
} else {
    Try {
        $NVM_HOME = Get-ItemPropertyValue -Path "HKCU:\Environment" -Name "NVM_HOME" -ErrorAction SilentlyContinue
        if ($NVM_HOME) {
            Write-Host "Found NVM_HOME from registry: $NVM_HOME"
        }
    } Catch {
        # NVM_HOME not found in registry
    }
}

if (-not $NVM_HOME) {
    # Check default location
    $defaultNvmHome = "$Env:USERPROFILE\.unvm"
    if (Test-Path $defaultNvmHome) {
        $NVM_HOME = $defaultNvmHome
        Write-Host "Found NVM installation at default location: $NVM_HOME"
    } else {
        Write-Host "Error: Could not find NVM_HOME. Universal NVM may not be installed." -ForegroundColor Red
        Write-Host ""
        Write-Host "If you have a custom NVM_HOME location, you can manually delete:"
        Write-Host "  1. The NVM installation directory"
        Write-Host "  2. NVM_HOME and NVM_LINK environment variables from System Properties"
        Write-Host "  3. NVM paths from your PATH environment variable"
        exit 1
    }
}

Write-Host ""

# Determine NVM paths
$NVM_BIN = "$NVM_HOME\bin"
$NVM_NODE = "$NVM_HOME\nodejs"
$NVM_LINK = "$NVM_NODE\bin"

# Get current PATH from registry
Try {
    $RegPath = Get-ItemPropertyValue -Path "HKCU:\Environment" -Name Path -ErrorAction SilentlyContinue
} Catch {
    $RegPath = ""
}

# Remove NVM paths from PATH
if ($RegPath) {
    Write-Host "Removing NVM paths from user PATH..."

    $pathArray = $RegPath.Split(';') | Where-Object {
        $_ -ne "" -and
        $_ -ne $NVM_BIN -and
        $_ -ne $NVM_LINK -and
        -not $_.StartsWith($NVM_HOME)
    }

    $newPath = [String]::Join(";", $pathArray)

    Try {
        Set-ItemProperty -Path "HKCU:\Environment" -Name "Path" -Value $newPath -ErrorAction Stop
        Write-Host "  Removed NVM paths from PATH" -ForegroundColor Green
    } Catch {
        Write-Host "  Warning: Could not update PATH: $_" -ForegroundColor Yellow
    }
}

Write-Host ""

# Remove NVM_HOME environment variable
Write-Host "Removing NVM environment variables..."
Try {
    Remove-ItemProperty -Path "HKCU:\Environment" -Name "NVM_HOME" -ErrorAction SilentlyContinue
    Write-Host "  Removed NVM_HOME" -ForegroundColor Green
} Catch {
    Write-Host "  NVM_HOME was not set" -ForegroundColor Gray
}

# Remove NVM_LINK environment variable
Try {
    Remove-ItemProperty -Path "HKCU:\Environment" -Name "NVM_LINK" -ErrorAction SilentlyContinue
    Write-Host "  Removed NVM_LINK" -ForegroundColor Green
} Catch {
    Write-Host "  NVM_LINK was not set" -ForegroundColor Gray
}

Write-Host ""

# Remove NVM_HOME directory
if (Test-Path $NVM_HOME) {
    Write-Host "Removing NVM installation directory..."
    Write-Host "  Deleting: $NVM_HOME"

    Try {
        Remove-Item -Path $NVM_HOME -Recurse -Force -ErrorAction Stop
        Write-Host "  Successfully deleted NVM directory" -ForegroundColor Green
    } Catch {
        Write-Host "  Error: Could not delete directory: $_" -ForegroundColor Red
        Write-Host "  You may need to close programs using Node.js and try again" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host ""
Write-Host "✓ Universal NVM has been uninstalled" -ForegroundColor Green
Write-Host ""
Write-Host "To complete the uninstallation:"
Write-Host "  1. Close and reopen your PowerShell windows"
Write-Host "  2. Log out and log back in (to clear environment variables)"
Write-Host ""
Write-Host "Note: Any Node.js versions installed in $NVM_HOME have been removed."
