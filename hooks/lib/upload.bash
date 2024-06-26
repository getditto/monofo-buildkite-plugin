#!/usr/bin/env bash
# Invokes `monofo upload` with a list of files.
#
# Required tools:
# - buildkite-agent
# - jq

[[ "${BASH_SOURCE[0]}" == "${0}" ]] && echo "Not for direct execution" && exit 2 || true
_lib_script_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
set -euo pipefail

# shellcheck source=./run.bash
source "$_lib_script_dir/run.bash"
MONOFO=$(monofo)

if [[ -z "${BUILDKITE_PLUGIN_CONFIGURATION:-}" ]]; then
  echo "Expected BUILDKITE_PLUGIN_CONFIGURATION to be set" >&2
  exit 1
fi

# Archives, deflates and uploads artifacts
#
# Does so:
#  - in parallel across all the artifacts that need to be built
#  - streaming the tar to the deflate operation
#  - TODO: not yet streaming the compressed artifact to the artifact upload task
#     because it doesn't accept stdin

if [[ "${MONOFO_HOOK_DEBUG:-0}" -eq 1 ]]; then
  set -x
fi

# Deflates and uploads artifacts
#
# We support a couple of possible formats. At the top level of the upload config
# is always an object, with a key for each artifact to be uploaded. Then, within
# that key, either:
#  - A list of strings, interpreted as glob patterns, or
#  - An object with a filesFrom property, interpreted as directions to find a
#    list of filenames
#
# In either case, for each top level upload key (artifact-to-upload) we want to
# call `monofo upload` in parallel

# Example: BUILDKITE_PLUGIN_CONFIGURATION='{"upload":{"build.catar.caibx":["dist/**","another/dist/**"],"node-modules.tar.lz4":{"filesFrom":"node-modules.list","null":true}}}'

pids=()
files=$(echo "$BUILDKITE_PLUGIN_CONFIGURATION" | jq -rc '.upload | to_entries | .[]')

for file in $files; do
  (
    config_file="$(echo "$file" | jq -rc '.key')"
    config_type="$(echo "$file" | jq -rc '.value | if type == "array" then "globs" else "file-list" end')"
    flags=(upload "$config_file")

    case "$config_type" in
      globs)
        for config in $(echo "$file" | jq -rc '.value[]'); do
          flags+=("$config")
        done
        ;;
      file-list)
        filesFrom="$(echo "$file" | jq -rc '.value.filesFrom')" # btw we don't have to support - (stdin) in the plugin context
        useNull=$(echo "$file" | jq -rc '.value.null')

        flags+=(--files-from "$filesFrom")

        if [[ "$useNull" == "true" ]]; then
          flags+=(--null)
        fi
        ;;
      *)
        echo "Invalid config type $config_type" >&2
        exit 2
        ;;
    esac

    echo "Going to run ${MONOFO} ${flags[*]}" >&2
    ${MONOFO} "${flags[@]}"
  ) &
  pids+=($!)
done

set +e
failures=0
for pid in ${pids[*]}; do
  if [[ $failures -gt 0 ]]; then
    echo "Interrupting because of failures in other uploads [$pid]"
    kill $pid 2> /dev/null || true
  else
    echo "Waiting to finish... [$pid]" >&2
    if ! wait "$pid"; then
      echo "" >&2
      echo "^^^ +++ :x: Failure in [$pid]! Cancelling remaining work and returning error" >&2
      failures=$((failures+1))
    fi
  fi
done
set -e

if [[ $failures -gt 0 ]]; then
  echo "Failed to download or inflate artifacts" >&2
  exit $failures
fi

echo "All done." >&2
exit 0
