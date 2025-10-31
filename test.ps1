New-Item -Path $Env:NVM_HOME\bin -ItemType "directory" -Force | Out-Null
New-Item -Path $Env:NVM_HOME\dist -ItemType "directory" -Force | Out-Null
Copy-Item -Path .\bin\* -Destination $Env:NVM_HOME\bin -Recurse -Force
Copy-Item -Path .\dist\* -Destination $Env:NVM_HOME\dist -Recurse -Force
Copy-Item -Path .\package.json -Destination $Env:NVM_HOME\ -Force
