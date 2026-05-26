#!/usr/bin/env bash
# Codex가 Shell/Bash/exec_command로 git commit을 직접 실행하려는 순간 실행된다.
# commit 명령을 감지하면 scripts/quality_gate.py를 먼저 실행한다.
# 품질 검증이 실패하면 PreToolUse deny 응답을 반환해 commit 실행을 차단한다.
# execute.py 내부 자동 commit은 Codex hook이 감지하지 못하므로 execute.py가 직접 검증한다.

set -u

INPUT=$(cat)

if [ -z "$INPUT" ]; then
  exit 0
fi

deny() {
  local reason="$1"
  python3 - "$reason" <<'PY'
import json
import sys

print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": sys.argv[1],
    }
}, ensure_ascii=False))
PY
}

COMMAND=$(
  python3 - "$INPUT" <<'PY'
import json
import sys

try:
    payload = json.loads(sys.argv[1])
except Exception:
    sys.exit(0)

tool_input = payload.get("tool_input") or {}
command = tool_input.get("command") or tool_input.get("cmd") or ""
if isinstance(command, str):
    print(command)
PY
)

if ! printf '%s\n' "$COMMAND" | grep -Eq '(^|[;&|[:space:]])git[[:space:]]+commit([[:space:]]|$)'; then
  exit 0
fi

ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
QUALITY_GATE="$ROOT/scripts/quality_gate.py"

if [ ! -f "$QUALITY_GATE" ]; then
  exit 0
fi

OUTPUT=$(python3 "$QUALITY_GATE" 2>&1)
STATUS=$?

if [ "$STATUS" -ne 0 ]; then
  deny "COMMIT GUARD: quality gate failed before git commit.\n$OUTPUT"
fi

exit 0
