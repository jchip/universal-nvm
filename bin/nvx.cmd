@echo off
setlocal enabledelayedexpansion

REM nvx - Execute commands with local node_modules/.bin in PATH

REM Check for help flag or no arguments
if "%~1"=="" goto :show_error_help
if "%~1"=="--help" goto :show_help
if "%~1"=="-h" goto :show_help

REM Check if .\node_modules\.bin exists
if exist ".\node_modules\.bin" (
    REM Add it to PATH for this session
    set "PATH=%cd%\node_modules\.bin;%PATH%"
)

REM Execute the command with all arguments
%*

REM Exit with the command's exit code
exit /b %ERRORLEVEL%

:show_error_help
echo Error: nvx requires a command to execute 1>&2
echo.
goto :show_help_content

:show_help
:show_help_content
echo nvx - Execute commands with local node_modules/.bin in PATH
echo.
echo Usage:
echo   nvx ^<command^> [args...]        Execute command with .\node_modules\.bin in PATH
echo   nvx --help, -h                 Show this help message
echo.
echo Examples:
echo   nvx eslint src/                Run eslint from local node_modules
echo   nvx prettier --write .         Run prettier from local node_modules

if "%~1"=="" exit /b 1
exit /b 0
