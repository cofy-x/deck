#!/usr/bin/env bash
# Common utility functions for deck CLI helper scripts.

if [[ -t 1 ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    NC='\033[0m'
else
    RED=''
    GREEN=''
    YELLOW=''
    NC=''
fi

check_deck_cli() {
    if ! command -v deck >/dev/null 2>&1; then
        error_exit "deck CLI not found" "MISSING_DEPENDENCY" 3
    fi
}

check_jq() {
    if ! command -v jq >/dev/null 2>&1; then
        error_exit "jq is required for JSON processing" "MISSING_DEPENDENCY" 3
    fi
}

error_exit() {
    local message="$1"
    local code="${2:-ERROR}"
    local exit_code="${3:-1}"

    printf '{"status":"error","error":"%s","code":"%s"}\n' "$(printf '%s' "$message" | sed 's/"/\\"/g')" "$code" >&2
    exit "$exit_code"
}

success_output() {
    local data="$1"
    echo "$data" | jq -c '{status:"success"} + .'
}

require_arg() {
    local arg="$1"
    local name="$2"

    if [ -z "$arg" ]; then
        error_exit "Missing required argument: $name" "INVALID_ARGUMENT" 2
    fi
}

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" >&2
}

log_info() {
    log "${GREEN}[INFO]${NC} $*"
}

log_warn() {
    log "${YELLOW}[WARN]${NC} $*"
}

log_error() {
    log "${RED}[ERROR]${NC} $*"
}

deck_cmd() {
    deck --no-color --format json "$@"
}

extract_json_payload() {
    local input="$1"
    awk '
        BEGIN { capture = 0 }
        /^[[:space:]]*[\[{]/ { capture = 1 }
        capture { print }
    ' <<< "$input"
}

deck_json() {
    local output
    local json

    if ! output=$(deck_cmd "$@" 2>&1); then
        return 1
    fi

    json=$(extract_json_payload "$output")
    if [ -z "$json" ]; then
        return 2
    fi

    if ! echo "$json" | jq empty >/dev/null 2>&1; then
        return 3
    fi

    printf '%s\n' "$json"
}

check_path_exists() {
    deck_cmd fs info "$1" >/dev/null 2>&1
}

check_dir_empty() {
    local path="$1"
    local ls_json

    if ! ls_json=$(deck_json fs ls "$path"); then
        return 1
    fi

    [ "$(echo "$ls_json" | jq 'length')" -eq 0 ]
}

deck_exec_run() {
    local command="$1"
    local cwd="${2:-}"
    local timeout="${3:-0}"

    local args=(exec run "$command")
    if [ -n "$cwd" ]; then
        args+=(--cwd "$cwd")
    fi
    if [ "$timeout" -gt 0 ] 2>/dev/null; then
        args+=(--timeout "$timeout")
    fi

    deck_cmd "${args[@]}"
}

extract_exec_exit_code() {
    local output="$1"
    local code

    code=$(echo "$output" | sed -n 's/.*Exit code:[[:space:]]*\([0-9][0-9]*\).*/\1/p' | tail -1)
    if [ -n "$code" ]; then
        echo "$code"
    else
        echo "0"
    fi
}

strip_exec_meta() {
    local output="$1"
    echo "$output" | sed '/Exit code:[[:space:]]*[0-9][0-9]*/d'
}

# Project discovery helpers.
detect_project_type() {
    local path="$1"

    if check_path_exists "$path/package.json"; then
        echo "nodejs"
    elif check_path_exists "$path/requirements.txt"; then
        echo "python"
    elif check_path_exists "$path/pom.xml"; then
        echo "maven"
    elif check_path_exists "$path/build.gradle"; then
        echo "gradle"
    elif check_path_exists "$path/Cargo.toml"; then
        echo "rust"
    elif check_path_exists "$path/go.mod"; then
        echo "golang"
    else
        echo "unknown"
    fi
}

get_package_manager() {
    case "$1" in
        nodejs) echo "npm" ;;
        python) echo "pip" ;;
        maven) echo "mvn" ;;
        gradle) echo "gradle" ;;
        rust) echo "cargo" ;;
        golang) echo "go" ;;
        *) echo "unknown" ;;
    esac
}

get_install_command() {
    case "$1" in
        nodejs) echo "npm install" ;;
        python) echo "pip install -r requirements.txt" ;;
        maven) echo "mvn install" ;;
        gradle) echo "gradle build" ;;
        rust) echo "cargo build" ;;
        golang) echo "go mod download" ;;
        *) echo "" ;;
    esac
}

get_test_command() {
    case "$1" in
        nodejs) echo "npm test" ;;
        python) echo "pytest" ;;
        maven) echo "mvn test" ;;
        gradle) echo "gradle test" ;;
        rust) echo "cargo test" ;;
        golang) echo "go test ./..." ;;
        *) echo "" ;;
    esac
}

detect_test_framework() {
    case "$1" in
        nodejs) echo "jest" ;;
        python) echo "pytest" ;;
        maven|gradle) echo "junit" ;;
        rust) echo "cargo" ;;
        golang) echo "gotest" ;;
        *) echo "unknown" ;;
    esac
}

parse_test_output() {
    local output="$1"
    local _framework="$2"

    local passed
    local failed
    local skipped

    passed=$(echo "$output" | grep -Eo '[0-9]+[[:space:]]+passed' | awk '{print $1}' | tail -1)
    failed=$(echo "$output" | grep -Eo '[0-9]+[[:space:]]+failed' | awk '{print $1}' | tail -1)
    skipped=$(echo "$output" | grep -Eo '[0-9]+[[:space:]]+skipped' | awk '{print $1}' | tail -1)

    passed="${passed:-0}"
    failed="${failed:-0}"
    skipped="${skipped:-0}"

    local total=$((passed + failed + skipped))
    echo "{\"total\":$total,\"passed\":$passed,\"failed\":$failed,\"skipped\":$skipped}"
}

validate_email() {
    local email="$1"
    [[ "$email" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]
}

check_disk_space() {
    local path="${1:-.}"
    local out
    local code

    if ! out=$(deck_exec_run "df -h '$path'"); then
        return 1
    fi

    code=$(extract_exec_exit_code "$out")
    if [ "$code" -ne 0 ]; then
        return 1
    fi

    strip_exec_meta "$out" | awk 'NF { line = $0 } END { print line }'
}

generate_backup_path() {
    local base_path="${1:-/tmp/backups}"
    local timestamp
    timestamp=$(date +%Y%m%d_%H%M%S)
    echo "$base_path/$timestamp"
}

get_staged_files() {
    local status_json="$1"
    echo "$status_json" | jq -r '.fileStatus[] | select(.staging != "Unmodified") | .name'
}

check_git_clean() {
    local path="$1"
    local status_json

    if ! status_json=$(deck_json git status "$path"); then
        return 1
    fi

    [ "$(echo "$status_json" | jq '[.fileStatus[] | select(.staging != "Unmodified" or .worktree != "Unmodified")] | length')" -eq 0 ]
}

recommend_actions() {
    local disk_line="$1"
    local port_count="$2"
    local session_count="$3"

    local recommendations=()

    if [ -n "$disk_line" ]; then
        local usage
        usage=$(echo "$disk_line" | awk '{for (i=1;i<=NF;i++) if ($i ~ /%$/) print $i}' | tail -1 | tr -d '%')
        if [ -n "$usage" ] && [ "$usage" -ge 85 ] 2>/dev/null; then
            recommendations+=("Disk usage is high (${usage}%). Consider cleanup before heavy operations.")
        fi
    fi

    if [ "$session_count" -gt 10 ] 2>/dev/null; then
        recommendations+=("Many active sessions detected (${session_count}). Delete unused sessions.")
    fi

    if [ "$port_count" -gt 50 ] 2>/dev/null; then
        recommendations+=("Many active ports detected (${port_count}). Verify background processes are expected.")
    fi

    if [ "${#recommendations[@]}" -eq 0 ]; then
        echo '[]'
        return 0
    fi

    printf '%s\n' "${recommendations[@]}" | jq -R . | jq -s .
}

export -f check_deck_cli
export -f check_jq
export -f error_exit
export -f success_output
export -f require_arg
export -f log
export -f log_info
export -f log_warn
export -f log_error
export -f deck_cmd
export -f extract_json_payload
export -f deck_json
export -f check_path_exists
export -f check_dir_empty
export -f deck_exec_run
export -f extract_exec_exit_code
export -f strip_exec_meta
export -f detect_project_type
export -f get_package_manager
export -f get_install_command
export -f get_test_command
export -f detect_test_framework
export -f parse_test_output
export -f validate_email
export -f check_disk_space
export -f generate_backup_path
export -f get_staged_files
export -f check_git_clean
export -f recommend_actions
