@echo off
setlocal enabledelayedexpansion

REM nvx - Execute commands with local node_modules/.bin in PATH

REM Check for help flag or no arguments
if "%~1"=="" goto :show_error_help
if "%~1"=="--help" goto :show_help
if "%~1"=="-h" goto :show_help

REM Get the command name
set "CMD_NAME=%~1"

REM Find node_modules\.bin with the command by searching up the directory tree
set "SEARCH_DIR=%cd%"
set "NODE_BIN_PATH="

:search_loop
if exist "%SEARCH_DIR%\node_modules\.bin" (
    REM Check if the command exists in this node_modules\.bin
    if exist "%SEARCH_DIR%\node_modules\.bin\%CMD_NAME%" (
        set "NODE_BIN_PATH=%SEARCH_DIR%\node_modules\.bin"
        goto :found_node_modules
    )
    REM Also check for .cmd extension
    if exist "%SEARCH_DIR%\node_modules\.bin\%CMD_NAME%.cmd" (
        set "NODE_BIN_PATH=%SEARCH_DIR%\node_modules\.bin"
        goto :found_node_modules
    )
)

REM Move to parent directory
for %%i in ("%SEARCH_DIR%") do set "PARENT_DIR=%%~dpi"
REM Remove trailing backslash
set "PARENT_DIR=%PARENT_DIR:~0,-1%"

REM Check if we've reached the root
if "%SEARCH_DIR%"=="%PARENT_DIR%" goto :search_done
if "%PARENT_DIR%"=="" goto :search_done

set "SEARCH_DIR=%PARENT_DIR%"
goto :search_loop

:found_node_modules
REM Add node_modules\.bin to PATH for this session
set "PATH=%NODE_BIN_PATH%;%PATH%"

:search_done

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
