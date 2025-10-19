#!/usr/bin/env pwsh
# nvx - Execute commands with local node_modules/.bin in PATH

# Detect platform
$IsUnix = $PSVersionTable.PSVersion.Major -ge 6 -and ($IsLinux -or $IsMacOS)
$pathSeparator = if ($IsUnix) { ":" } else { ";" }

# Check for help flag
if ($args.Count -eq 0 -or $args[0] -eq "--help" -or $args[0] -eq "-h") {
    if ($args.Count -eq 0) {
        Write-Error "Error: nvx requires a command to execute"
        Write-Host ""
    }

    Write-Host "nvx - Execute commands with local node_modules/.bin in PATH"
    Write-Host ""
    Write-Host "Usage:"
    Write-Host "  nvx <command> [args...]        Execute command with ./node_modules/.bin in PATH"
    Write-Host "  nvx --help, -h                 Show this help message"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  nvx eslint src/                Run eslint from local node_modules"
    Write-Host "  nvx prettier --write .         Run prettier from local node_modules"

    if ($args.Count -eq 0) {
        exit 1
    }
    exit 0
}

# Check if ./node_modules/.bin exists (works on both Windows and Unix)
$nodeBinPath = if ($IsUnix) { "./node_modules/.bin" } else { ".\node_modules\.bin" }
if (Test-Path $nodeBinPath -PathType Container) {
    # Get absolute path
    $binPath = (Resolve-Path $nodeBinPath).Path
    # Add it to PATH for this session
    $env:PATH = "$binPath$pathSeparator$env:PATH"
}

# Execute the command with arguments
$command = $args[0]
$commandArgs = if ($args.Count -gt 1) { $args[1..($args.Count - 1)] } else { @() }

# On Windows, try .cmd extension if command doesn't have an extension
if (-not $IsUnix -and $command -notmatch '\.' ) {
    $cmdVersion = Get-Command "${command}.cmd" -ErrorAction SilentlyContinue
    if ($cmdVersion) {
        # Use the full path from Get-Command
        $command = $cmdVersion.Source
    }
}

if ($commandArgs) {
    & $command @commandArgs
} else {
    & $command
}

# Exit with the command's exit code
exit $LASTEXITCODE
