[[ "${BASH_SOURCE[0]}" == "${0}" ]] && echo "Not for direct execution" && exit 2 || true
set -euox pipefail

script_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cmd_path="${script_dir}/../../bin/run"

# This turns on debugging for monofo, which is important to see what's going on
export DEBUG="monofo:*"

(
    # Ensure typescript has been built
    cd "${script_dir}/../.."
    yarn build
)

function monofo() {
    echo "$cmd_path ${*}"
}
