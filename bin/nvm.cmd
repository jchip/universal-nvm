@ECHO OFF

SETLOCAL

SET NVM_RUN_ID=1

SET "NODE_EXE=%~dp0\..\node.exe"

IF NOT EXIST "%NODE_EXE%" (
  SET "NODE_EXE=node"
)

"%NODE_EXE%" "%~dp0\..\dist\nvm.js" %1 %2 %3 %4

ENDLOCAL

IF not %ERRORLEVEL% == 0 EXIT /b %ERRORLEVEL%

IF not exist "%TMP%\nvm_env1.cmd" EXIT /b 0

IF exist "%TMP%\nvm_envx.cmd" del "%TMP%\nvm_envx.cmd"
ren "%TMP%\nvm_env1.cmd" "nvm_envx.cmd"
call "%TMP%\nvm_envx.cmd"
del "%TMP%\nvm_envx.cmd"

IF "%NVM_INSTALL%"=="" GOTO EXIT

SET NVM_INSTALL_VER=%NVM_INSTALL%
set NVM_INSTALL=

IF exist "%NVM_HOME%\post-install.cmd" cmd.exe /C %NVM_HOME%\post-install.cmd %NVM_INSTALL_VER%

SET NVM_INSTALL_VER=

:EXIT

