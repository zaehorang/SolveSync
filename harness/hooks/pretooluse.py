#!/usr/bin/env python3
"""Codex PreToolUse hook.

메인 저장소의 .codex/config.toml에 상대 경로로 등록되어 있다. 상대 경로라 각
worktree가 자기 branch에 체크아웃된 사본을 실행한다.

stdin으로 hook payload를 받아 아무것도 출력하지 않거나(허용) deny 결정을
출력한다. 이 스크립트 안에서 무슨 일이 생기든 결과는 deny다. 죽으면 열리는
gate는 gate가 아니다.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import policy  # noqa: E402


def deny(reason: str) -> None:
    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": reason,
                }
            },
            ensure_ascii=False,
        )
    )
    sys.exit(0)


def main() -> None:
    payload = json.load(sys.stdin)
    tool = payload.get("tool_name")
    tool_input = payload.get("tool_input") or {}
    worktree = payload.get("cwd") or str(Path.cwd())

    if tool == "Bash":
        reason = policy.check_bash(tool_input.get("command", ""), worktree)
    elif tool == "apply_patch":
        reason = policy.check_apply_patch(tool_input.get("command", ""), worktree)
    else:
        reason = None

    if reason:
        deny(reason)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # fail-closed
        deny(
            "하네스 정책 hook이 실패했으므로 이 호출을 차단했습니다 "
            f"({type(error).__name__}: {error}). 재시도하지 말고 이 사실을 보고하세요."
        )
