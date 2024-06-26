#!/usr/bin/env bash
# Invokes `monofo pipeline` and `buildkite-agent pipeline upload`
#
# Required tools:
# - buildkite-agent

[[ "${BASH_SOURCE[0]}" == "${0}" ]] && echo "Not for direct execution" && exit 2 || true
_lib_script_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
set -euo pipefail

# Debugging
echo "generate.bash"

# shellcheck source=./run.bash
source "$_lib_script_dir/run.bash"

MONOFO_CMD=$(monofo "--version")
echo "MONOFO_CMD: $MONOFO_CMD"
eval "$MONOFO_CMD"
MONOFO_CMD=$(monofo "pipeline")

# Usage: create a pipeline that looks like this:
#
# steps:
#   - name: ":pipeline: Generate pipeline"
#     plugins:
#       - seek-oss/aws-sm#v2.2.1: # for example, but your secret management might be e.g. via S3 bucket or "env" file instead
#           env:
#             BUILDKITE_API_ACCESS_TOKEN: "global/buildkite-api-access-token"
#       - vital-software/monofo#<latest>:
#           generate: pipeline
#
# If you had a previous generator, you need to wait until all branches have the
# script before calling it, or change the command to:
#
# git merge-base --is-ancestor <merge-commit-of-generate-pipeline> HEAD && .buildkite/generate-pipeline || ( <previous-command> )
#
# This script installs and calls monofo with a static version so the install is
# cached and fast

PIPELINE_FILE="$(mktemp /tmp/generate-pipeline.XXXXXX)"
BUILDKITE_AGENT_ACCESS_TOKEN=${BUILDKITE_AGENT_ACCESS_TOKEN:-}

echo "--- Fetching other branches" >&2
git fetch -v origin +refs/heads/*:refs/remotes/origin/*

echo "+++ :pipeline: Generating... going to run ${MONOFO_CMD}" >&2
$MONOFO_CMD > "$PIPELINE_FILE"

echo "--- :pipeline: Result" >&2
cat "$PIPELINE_FILE"

if [[ -n "$BUILDKITE_AGENT_ACCESS_TOKEN" ]]; then
  echo "--- :pipeline: Upload" >&2
  buildkite-agent pipeline upload < "$PIPELINE_FILE"
else
  echo "Skipping pipeline upload, because no BUILDKITE_AGENT_ACCESS_TOKEN was set: probably not running in Buildkite"
fi

rm -f "$PIPELINE_FILE"
exit 0
