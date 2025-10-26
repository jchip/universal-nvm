[ -z $NVM_HOME ] && NVM_HOME=$HOME/.unvm
mkdir -p $NVM_HOME/bin
mkdir -p $NVM_HOME/dist
cp bin/* $NVM_HOME/bin
cp dist/nvm.js $NVM_HOME/dist
cp package.json $NVM_HOME/package.json
