#!/usr/bin/env pwsh
# nvx - Execute commands with local node_modules/.bin in PATH

# Check for help flag
if ($args.Count -eq 0 -or $args[0] -eq "--help" -or $args[0] -eq "-h") {
    if ($args.Count -eq 0) {
        Write-Error "Error: nvx requires a command to execute"
        Write-Host ""
    }

    Write-Host "nvx - Execute commands with local node_modules/.bin in PATH"
    Write-Host ""
    Write-Host "Usage:"
    Write-Host "  nvx <command> [args...]        Execute command with .\node_modules\.bin in PATH"
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

# Check if .\node_modules\.bin exists
if (Test-Path ".\node_modules\.bin" -PathType Container) {
    # Get absolute path
    $binPath = (Resolve-Path ".\node_modules\.bin").Path
    # Add it to PATH for this session
    $env:PATH = "$binPath;$env:PATH"
}

# Execute the command with arguments
$command = $args[0]
$commandArgs = $args[1..($args.Count - 1)]

if ($commandArgs) {
    & $command @commandArgs
} else {
    & $command
}

# Exit with the command's exit code
exit $LASTEXITCODE
