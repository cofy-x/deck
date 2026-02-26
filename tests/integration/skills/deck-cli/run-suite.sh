#!/usr/bin/env bash

# Integration suite for skills/deck-cli/scripts using desktop sandbox container.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../../.." && pwd)"
source "${SCRIPT_DIR}/lib/helpers.sh"

: "${DECK_SKILL_TEST_CONTAINER_NAME:=deck-desktop-sandbox-ai-skill-test}"
: "${DECK_SKILL_TEST_IMAGE:=deck/desktop-sandbox-ai:latest}"
: "${DECK_SKILL_TEST_SKIP_BUILD:=0}"
: "${DECK_SKILL_TEST_TIMEOUT_SEC:=180}"
: "${DECK_SKILL_TEST_SCROLL_TIMEOUT_SEC:=8}"
: "${DECK_SKILL_TEST_ROOT:=/tmp/deck-skill-it}"

: "${HOST_DAEMON_PORT:=13280}"
: "${HOST_OPENCODE_PORT:=15496}"
: "${HOST_VNC_PORT:=16911}"
: "${HOST_NOVNC_PORT:=17090}"
: "${HOST_SSH_PORT:=13230}"
: "${HOST_WEB_TERMINAL_PORT:=13232}"

export DECK_SKILL_TEST_CONTAINER_NAME
export DECK_SKILL_TEST_IMAGE
export DECK_SKILL_TEST_SKIP_BUILD
export DECK_SKILL_TEST_TIMEOUT_SEC
export DECK_SKILL_TEST_SCROLL_TIMEOUT_SEC
export DECK_SKILL_TEST_ROOT
export HOST_DAEMON_PORT
export HOST_OPENCODE_PORT
export HOST_VNC_PORT
export HOST_NOVNC_PORT
export HOST_SSH_PORT
export HOST_WEB_TERMINAL_PORT

export DECK_DAEMON_URL="http://localhost:${HOST_DAEMON_PORT}"

SKILL_SCRIPT_DIR="${REPO_ROOT}/skills/deck-cli/scripts"
START_SCRIPT="${SCRIPT_DIR}/start-sandbox.sh"
WAIT_SCRIPT="${SCRIPT_DIR}/wait-computeruse-ready.sh"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/deck-skill-it.XXXXXX")"

TEST_TOTAL=0
TEST_FAILED=0

GO_PASS_DIR="${DECK_SKILL_TEST_ROOT}/go-pass"
GO_FAIL_DIR="${DECK_SKILL_TEST_ROOT}/go-fail"
BACKUP_SRC_DIR="${DECK_SKILL_TEST_ROOT}/backup-src"
REPLACE_DIR="${DECK_SKILL_TEST_ROOT}/replace-src"
GIT_REPO_DIR="${DECK_SKILL_TEST_ROOT}/git-repo"

cleanup() {
    local exit_code=$?
    log_info "Cleaning up integration test environment"
    remove_container_if_exists "$DECK_SKILL_TEST_CONTAINER_NAME"
    rm -rf "$TMP_DIR"
    if [ "$exit_code" -ne 0 ]; then
        log_warn "Suite exited with code ${exit_code}"
    fi
}
trap cleanup EXIT

deck_cmd_json() {
    deck --no-color --format json "$@"
}

require_prerequisites() {
    require_cmd docker
    require_cmd make
    require_cmd go
    require_cmd jq
    require_cmd curl
}

build_artifacts_if_needed() {
    if [ "$DECK_SKILL_TEST_SKIP_BUILD" = "1" ]; then
        log_info "Skipping builds because DECK_SKILL_TEST_SKIP_BUILD=1"
        return
    fi

    log_info "Building local CLI binary (host platform)"
    (cd "$REPO_ROOT" && make build-cli)

    log_info "Building desktop sandbox AI image"
    (cd "$REPO_ROOT" && make build-desktop-sandbox-ai)
}

configure_deck_binary() {
    local goos
    local goarch
    local local_cli
    local deck_shim_dir

    goos="$(go env GOOS)"
    goarch="$(go env GOARCH)"
    local_cli="${REPO_ROOT}/dist/${goos}_${goarch}/cli"

    if [ ! -x "$local_cli" ]; then
        log_error "Local deck CLI binary not found or not executable: $local_cli"
        log_error "Run make build-cli or unset DECK_SKILL_TEST_SKIP_BUILD."
        exit 1
    fi

    deck_shim_dir="${TMP_DIR}/bin"
    mkdir -p "$deck_shim_dir"
    ln -sf "$local_cli" "${deck_shim_dir}/deck"
    export PATH="${deck_shim_dir}:$(dirname "$local_cli"):${PATH}"
    log_info "Using deck binary via shim: ${deck_shim_dir}/deck -> $local_cli"
}

prepare_fixtures() {
    log_info "Preparing fixtures under ${DECK_SKILL_TEST_ROOT}"

    local q_root
    local q_go_pass
    local q_go_fail
    local q_backup
    local q_replace
    local q_git_repo
    printf -v q_root '%q' "$DECK_SKILL_TEST_ROOT"
    printf -v q_go_pass '%q' "$GO_PASS_DIR"
    printf -v q_go_fail '%q' "$GO_FAIL_DIR"
    printf -v q_backup '%q' "$BACKUP_SRC_DIR"
    printf -v q_replace '%q' "$REPLACE_DIR"
    printf -v q_git_repo '%q' "$GIT_REPO_DIR"
    deck_cmd_json exec run "sh -lc 'rm -rf ${q_root} && mkdir -p ${q_go_pass} ${q_go_fail} ${q_backup} ${q_replace} ${q_git_repo}'" >/dev/null

    local pass_go_mod
    local pass_go_test
    pass_go_mod=$'module example.com/deckskillpass\n\ngo 1.22\n'
    pass_go_test=$'package deckskillpass\n\nimport "testing"\n\nfunc TestPass(t *testing.T) {}\n'
    deck_cmd_json fs write "${GO_PASS_DIR}/go.mod" "$pass_go_mod" >/dev/null
    deck_cmd_json fs write "${GO_PASS_DIR}/pass_test.go" "$pass_go_test" >/dev/null

    local fail_go_mod
    local fail_go_test
    fail_go_mod=$'module example.com/deckskillfail\n\ngo 1.22\n'
    fail_go_test=$'package deckskillfail\n\nimport "testing"\n\nfunc TestFail(t *testing.T) {\n\tt.Fatalf("forced failure")\n}\n'
    deck_cmd_json fs write "${GO_FAIL_DIR}/go.mod" "$fail_go_mod" >/dev/null
    deck_cmd_json fs write "${GO_FAIL_DIR}/fail_test.go" "$fail_go_test" >/dev/null

    deck_cmd_json fs write "${BACKUP_SRC_DIR}/notes.txt" $'alpha\nbeta\n' >/dev/null
    deck_cmd_json fs write "${BACKUP_SRC_DIR}/settings.json" $'{"enabled":true,"name":"deck"}\n' >/dev/null

    deck_cmd_json fs write "${REPLACE_DIR}/sample.txt" $'OldName is here\nOldName appears twice\n' >/dev/null

    local q_repo
    printf -v q_repo '%q' "$GIT_REPO_DIR"
    deck_cmd_json exec run "sh -lc 'cd ${q_repo} && git init >/dev/null'" >/dev/null
    deck_cmd_json fs write "${GIT_REPO_DIR}/README.md" $'# Deck Skill Integration\n' >/dev/null
    deck_cmd_json exec run "sh -lc 'cd ${q_repo} && git add README.md'" >/dev/null
}

run_case() {
    local name="$1"
    shift

    TEST_TOTAL=$((TEST_TOTAL + 1))
    if "$@"; then
        log_info "PASS: ${name}"
    else
        TEST_FAILED=$((TEST_FAILED + 1))
        log_error "FAIL: ${name}"
    fi
}

test_health_check() {
    local out err ec
    out="$(mktemp "${TMP_DIR}/health-check.out.XXXXXX")"
    err="$(mktemp "${TMP_DIR}/health-check.err.XXXXXX")"

    ec="$(run_capture "$out" "$err" bash "${SKILL_SCRIPT_DIR}/health-check.sh")"
    if [ "$ec" -ne 0 ] && [ "$ec" -ne 2 ]; then
        print_failure_context "health-check exit code" "$ec" "$out" "$err"
        return 1
    fi
    if ! assert_json_expr "$out" '.status == "success"'; then
        print_failure_context "health-check status=success" "$ec" "$out" "$err"
        return 1
    fi
    if ! assert_json_expr "$out" '.daemon != null and .system != null and .tests != null'; then
        print_failure_context "health-check required fields" "$ec" "$out" "$err"
        return 1
    fi
    return 0
}

test_diagnose() {
    local out err ec
    out="$(mktemp "${TMP_DIR}/diagnose.out.XXXXXX")"
    err="$(mktemp "${TMP_DIR}/diagnose.err.XXXXXX")"

    ec="$(run_capture "$out" "$err" bash "${SKILL_SCRIPT_DIR}/diagnose.sh")"
    if [ "$ec" -ne 0 ]; then
        print_failure_context "diagnose exit code" "$ec" "$out" "$err"
        return 1
    fi
    if ! assert_json_expr "$out" '.status == "success"'; then
        print_failure_context "diagnose status=success" "$ec" "$out" "$err"
        return 1
    fi
    if ! assert_json_expr "$out" 'has("workdir") and has("homedir") and has("active_ports") and has("recommendations")'; then
        print_failure_context "diagnose required fields" "$ec" "$out" "$err"
        return 1
    fi
    return 0
}

test_run_tests_success() {
    local out err ec
    out="$(mktemp "${TMP_DIR}/run-tests-success.out.XXXXXX")"
    err="$(mktemp "${TMP_DIR}/run-tests-success.err.XXXXXX")"

    ec="$(run_capture "$out" "$err" bash "${SKILL_SCRIPT_DIR}/run-tests.sh" "$GO_PASS_DIR" "go test ./...")"
    if [ "$ec" -ne 0 ]; then
        print_failure_context "run-tests success exit code" "$ec" "$out" "$err"
        return 1
    fi
    if ! assert_json_expr "$out" '.status == "success" and .exitCode == 0'; then
        print_failure_context "run-tests success contract" "$ec" "$out" "$err"
        return 1
    fi
    return 0
}

test_run_tests_failure() {
    local out err ec
    out="$(mktemp "${TMP_DIR}/run-tests-failure.out.XXXXXX")"
    err="$(mktemp "${TMP_DIR}/run-tests-failure.err.XXXXXX")"

    ec="$(run_capture "$out" "$err" bash "${SKILL_SCRIPT_DIR}/run-tests.sh" "$GO_FAIL_DIR" "go test ./...")"
    if [ "$ec" -ne 4 ]; then
        print_failure_context "run-tests failure exit code" "$ec" "$out" "$err"
        return 1
    fi
    if ! assert_json_expr "$err" '.status == "error" and .code == "TESTS_FAILED"'; then
        print_failure_context "run-tests failure contract" "$ec" "$out" "$err"
        return 1
    fi
    return 0
}

test_mouse_scroll_cli_no_hang() {
    local direction out err ec

    for direction in down up; do
        out="$(mktemp "${TMP_DIR}/mouse-scroll-cli-${direction}.out.XXXXXX")"
        err="$(mktemp "${TMP_DIR}/mouse-scroll-cli-${direction}.err.XXXXXX")"

        ec="$(run_capture_with_timeout "$DECK_SKILL_TEST_SCROLL_TIMEOUT_SEC" "$out" "$err" deck_cmd_json computer mouse scroll 640 360 "$direction")"
        if [ "$ec" -eq 124 ]; then
            print_failure_context "mouse-scroll cli timeout (${direction})" "$ec" "$out" "$err"
            return 1
        fi
        if [ "$ec" -ne 0 ]; then
            print_failure_context "mouse-scroll cli exit code (${direction})" "$ec" "$out" "$err"
            return 1
        fi
        if ! assert_json_expr "$out" '.success == true'; then
            print_failure_context "mouse-scroll cli success contract (${direction})" "$ec" "$out" "$err"
            return 1
        fi
    done

    return 0
}

test_mouse_scroll_http_no_hang() {
    local direction body out err ec http_code

    for direction in down up; do
        body="$(mktemp "${TMP_DIR}/mouse-scroll-http-${direction}.body.XXXXXX")"
        out="$(mktemp "${TMP_DIR}/mouse-scroll-http-${direction}.out.XXXXXX")"
        err="$(mktemp "${TMP_DIR}/mouse-scroll-http-${direction}.err.XXXXXX")"

        ec="$(run_capture "$out" "$err" curl --silent --show-error --max-time 5 --request POST --url "http://localhost:${HOST_DAEMON_PORT}/computeruse/mouse/scroll" --header "content-type: application/json" --output "$body" --write-out "%{http_code}" --data "{\"x\":640,\"y\":360,\"direction\":\"${direction}\",\"amount\":3}")"
        if [ "$ec" -ne 0 ]; then
            print_failure_context "mouse-scroll http curl exit code (${direction})" "$ec" "$out" "$err"
            if [ -s "$body" ]; then
                log_error "HTTP response body:"
                sed -n '1,120p' "$body" >&2
            fi
            return 1
        fi

        http_code="$(cat "$out")"
        if [ "$http_code" != "200" ]; then
            log_error "mouse-scroll http expected 200, got ${http_code} (${direction})"
            if [ -s "$body" ]; then
                log_error "HTTP response body:"
                sed -n '1,120p' "$body" >&2
            fi
            if [ -s "$err" ]; then
                log_error "curl stderr:"
                sed -n '1,120p' "$err" >&2
            fi
            return 1
        fi

        if ! assert_json_expr "$body" '.success == true'; then
            log_error "mouse-scroll http success contract failed (${direction})"
            sed -n '1,120p' "$body" >&2
            return 1
        fi
    done

    return 0
}

test_backup_files() {
    local out err ec backup_path
    out="$(mktemp "${TMP_DIR}/backup-files.out.XXXXXX")"
    err="$(mktemp "${TMP_DIR}/backup-files.err.XXXXXX")"

    ec="$(run_capture "$out" "$err" bash "${SKILL_SCRIPT_DIR}/backup-files.sh" "$BACKUP_SRC_DIR")"
    if [ "$ec" -ne 0 ]; then
        print_failure_context "backup-files exit code" "$ec" "$out" "$err"
        return 1
    fi
    if ! assert_json_expr "$out" '.status == "success" and .backup.files >= 2'; then
        print_failure_context "backup-files success contract" "$ec" "$out" "$err"
        return 1
    fi

    backup_path="$(json_payload_from_file "$out" | jq -r '.backup.path // empty')"
    if [ -z "$backup_path" ]; then
        print_failure_context "backup-files path missing" "$ec" "$out" "$err"
        return 1
    fi
    if ! deck_cmd_json fs info "$backup_path" >/dev/null 2>&1; then
        print_failure_context "backup-files path verification" "$ec" "$out" "$err"
        return 1
    fi
    return 0
}

test_batch_replace() {
    local out_preview err_preview ec_preview
    local out_exec err_exec ec_exec
    local cat_out

    out_preview="$(mktemp "${TMP_DIR}/batch-replace-preview.out.XXXXXX")"
    err_preview="$(mktemp "${TMP_DIR}/batch-replace-preview.err.XXXXXX")"
    out_exec="$(mktemp "${TMP_DIR}/batch-replace-exec.out.XXXXXX")"
    err_exec="$(mktemp "${TMP_DIR}/batch-replace-exec.err.XXXXXX")"

    ec_preview="$(run_capture "$out_preview" "$err_preview" bash "${SKILL_SCRIPT_DIR}/batch-replace.sh" "$REPLACE_DIR" "OldName" "NewName" "--preview")"
    if [ "$ec_preview" -ne 0 ]; then
        print_failure_context "batch-replace preview exit code" "$ec_preview" "$out_preview" "$err_preview"
        return 1
    fi
    if ! assert_json_expr "$out_preview" '.status == "success" and .preview == true and .matchingFiles >= 1'; then
        print_failure_context "batch-replace preview contract" "$ec_preview" "$out_preview" "$err_preview"
        return 1
    fi

    ec_exec="$(run_capture "$out_exec" "$err_exec" bash "${SKILL_SCRIPT_DIR}/batch-replace.sh" "$REPLACE_DIR" "OldName" "NewName")"
    if [ "$ec_exec" -ne 0 ]; then
        print_failure_context "batch-replace execute exit code" "$ec_exec" "$out_exec" "$err_exec"
        return 1
    fi
    if ! assert_json_expr "$out_exec" '.status == "success" and .changed >= 1'; then
        print_failure_context "batch-replace execute contract" "$ec_exec" "$out_exec" "$err_exec"
        return 1
    fi

    cat_out="$(mktemp "${TMP_DIR}/batch-replace-cat.out.XXXXXX")"
    if ! deck --no-color fs cat "${REPLACE_DIR}/sample.txt" >"$cat_out" 2>/dev/null; then
        log_error "Failed to read replaced file content"
        sed -n '1,120p' "$out_exec" >&2
        return 1
    fi
    if ! grep -q "NewName" "$cat_out"; then
        log_error "Replacement verification failed: NewName not found"
        sed -n '1,120p' "$cat_out" >&2
        return 1
    fi
    return 0
}

test_git_safe_commit() {
    local out err ec
    local status_json
    out="$(mktemp "${TMP_DIR}/git-safe-commit.out.XXXXXX")"
    err="$(mktemp "${TMP_DIR}/git-safe-commit.err.XXXXXX")"

    ec="$(run_capture "$out" "$err" bash "${SKILL_SCRIPT_DIR}/git-safe-commit.sh" "$GIT_REPO_DIR" "test: integration commit" "Deck Tester" "tester@example.com")"
    if [ "$ec" -ne 0 ]; then
        print_failure_context "git-safe-commit exit code" "$ec" "$out" "$err"
        return 1
    fi
    if ! assert_json_expr "$out" '.status == "success" and .commit.files >= 1'; then
        print_failure_context "git-safe-commit contract" "$ec" "$out" "$err"
        return 1
    fi

    status_json="$(deck_cmd_json git status "$GIT_REPO_DIR")"
    if ! echo "$status_json" | jq -e '[.fileStatus[] | select(.staging != "Unmodified")] | length == 0' >/dev/null 2>&1; then
        log_error "git-safe-commit verification failed: staged files still exist"
        echo "$status_json" >&2
        return 1
    fi
    return 0
}

main() {
    require_prerequisites
    build_artifacts_if_needed
    configure_deck_binary

    log_info "Starting sandbox with test ports"
    bash "$START_SCRIPT"

    if ! bash "$WAIT_SCRIPT" >"${TMP_DIR}/computeruse-ready.json"; then
        log_error "Computer-use readiness gate failed"
        exit 1
    fi

    run_case "mouse scroll cli no-hang regression" test_mouse_scroll_cli_no_hang
    run_case "mouse scroll http no-hang regression" test_mouse_scroll_http_no_hang

    prepare_fixtures

    run_case "health-check.sh" test_health_check
    run_case "diagnose.sh" test_diagnose
    run_case "run-tests.sh success path" test_run_tests_success
    run_case "run-tests.sh failure path" test_run_tests_failure
    run_case "backup-files.sh" test_backup_files
    run_case "batch-replace.sh preview+execute" test_batch_replace
    run_case "git-safe-commit.sh" test_git_safe_commit

    log_info "Test summary: total=${TEST_TOTAL}, failed=${TEST_FAILED}"
    if [ "$TEST_FAILED" -ne 0 ]; then
        dump_container_logs "$DECK_SKILL_TEST_CONTAINER_NAME" 120
        exit 1
    fi
}

main "$@"
