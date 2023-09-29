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
cmd_path="${script_dir}/../../bin/run"

# This turns on debugging for monofo, which is important to see what's going on
export DEBUG="monofo:*"

# Force monofo to only look at the PR's target/base branch
export MONOFO_DEFAULT_BRANCH=${BUILDKITE_PULL_REQUEST_BASE_BRANCH}
export MONOFO_INTEGRATION_BRANCH=${BUILDKITE_PULL_REQUEST_BASE_BRANCH}

(
    # Ensure typescript has been built
    cd "${script_dir}/../.."
    yarn install
    yarn build
)

function monofo() {
    echo "$cmd_path ${*}"
}
