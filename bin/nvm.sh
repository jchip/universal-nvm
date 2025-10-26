# Backward compatibility alias - nvm command points to unvm
# This file provides the nvm alias for users upgrading from older versions

# Get the directory of this script (works when sourced)
if [ -n "$BASH_SOURCE" ]; then
  NVM_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
elif [ -n "$ZSH_VERSION" ]; then
  NVM_SCRIPT_DIR="$(cd "$(dirname "${(%):-%x}")" && pwd)"
else
  NVM_SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
fi

# Source the main unvm.sh file
source "${NVM_SCRIPT_DIR}/unvm.sh"
unset NVM_SCRIPT_DIR
