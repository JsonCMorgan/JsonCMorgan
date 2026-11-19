#!/usr/bin/env bash
# Usage: drift-tamers/tests/run_tests.sh  (needs `godot` 4.3 on PATH or GODOT=/path/to/godot)
# Fails on non-zero exit or on any engine SCRIPT ERROR / ERROR / WARNING line in the output.
set -uo pipefail
GODOT="${GODOT:-godot}"
cd "$(dirname "$0")/.."
status=0

run() {
	local label="$1"; shift
	echo "::group::$label"
	local log
	log="$(mktemp)"
	timeout 120 "$GODOT" --headless --path . "$@" 2>&1 | tee "$log"
	local code=${PIPESTATUS[0]}
	echo "::endgroup::"
	if [ "$code" -ne 0 ]; then
		echo "FAILED ($label): exit code $code"
		status=1
	fi
	if grep -nE '^(SCRIPT ERROR|ERROR|WARNING):' "$log"; then
		echo "FAILED ($label): engine errors or warnings in output"
		status=1
	fi
	rm -f "$log"
}

run "import" --editor --quit
run "unit tests" res://tests/test_runner.tscn
run "phase3b ship smoke" res://tests/phase3b_smoke.tscn
for mission in survey rescue recovery bounty escort; do
	run "smoke: $mission" res://tests/smoke_run.tscn -- --mission="$mission"
done
exit $status
