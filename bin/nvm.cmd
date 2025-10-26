@ECHO OFF
REM Backward compatibility alias - nvm command points to unvm
REM This file provides the nvm alias for users upgrading from older versions

CALL "%~dp0unvm.cmd" %*
