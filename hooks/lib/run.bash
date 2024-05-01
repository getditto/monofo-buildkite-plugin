#!/usr/bin/env bash
# Declares a shell function `monofo` that can be used to invoke monofo via `cmd_path`.
#
# Required tools:
# - tsc (invoked by `yarn build`)
# - yarn

[[ "${BASH_SOURCE[0]}" == "${0}" ]] && echo "Not for direct execution" && exit 2 || true
set -euo pipefail

# Debugging
echo "run.bash"

script_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
plugin_root="${script_dir}/../.."
cmd_path="${plugin_root}/bin/run"

# This turns on debugging for monofo, which is important to see what's going on
export DEBUG="monofo:*"

# Force monofo to only look at the PR's target/base branch
export MONOFO_DEFAULT_BRANCH=${BUILDKITE_PULL_REQUEST_BASE_BRANCH}
export MONOFO_INTEGRATION_BRANCH=${BUILDKITE_PULL_REQUEST_BASE_BRANCH}

# Init NVM and build monofo plugin
pushd "${plugin_root}"

# Load NVM
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install && nvm use

# Ensure typescript has been built
yarn install
yarn build

# Return to build workspace
popd

function monofo() {
    echo "$cmd_path ${*}"
}
