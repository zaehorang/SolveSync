#!/usr/bin/env python3
"""Claude Code PreToolUse hook.

저장소의 `.claude/settings.json`에 등록된다. 대화형 Claude Code 세션에 하네스
정책을 붙이는 유일한 경로다. 이것이 없으면 대화형 세션에는 금지 경로 차단도,
테스트 선행 gate도, 주 디렉터리 branch 전환 차단도 커밋 시점까지 전혀 없다.

이 스크립트 안에서 무슨 일이 생기든 결과는 deny다. 죽으면 열리는 gate는 gate가
아니다.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import policy  # noqa: E402

# 파일을 쓰는 tool만 경로를 검사한다. Read도 `file_path`를 갖고 있으므로 key만
# 보고 판단하면 읽기까지 테스트 선행 gate에 막힌다.
WRITE_TOOLS = ("Write", "Edit", "MultiEdit", "NotebookEdit")
PATH_KEYS = ("file_path", "notebook_path")


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


def in_main_worktree(cwd: str) -> bool:
    """cwd가 주 작업 디렉터리인가.

    git이 실패하면 False다. 저장소 밖에서 열린 세션까지 branch 전환을 막을 이유는
    없고, 커밋은 어차피 pre-commit gate가 따로 본다.
    """
    result = subprocess.run(
        ["git", "rev-parse", "--git-dir", "--git-common-dir"],
        cwd=cwd,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return False
    lines = result.stdout.split()
    if len(lines) != 2:
        return False
    # git이 주는 경로는 cwd 기준 상대 경로일 수 있다. hook 프로세스의 cwd가 아니라
    # payload의 cwd를 기준으로 풀어야 한다.
    resolved = [os.path.normpath(os.path.join(cwd, line)) for line in lines]
    return policy.check_worktree_isolation(*resolved) is not None


def write_targets(tool_input: dict) -> list[str]:
    return [str(tool_input[key]) for key in PATH_KEYS if tool_input.get(key)]


def main() -> None:
    payload = json.load(sys.stdin)
    tool = payload.get("tool_name")
    tool_input = payload.get("tool_input") or {}
    cwd = payload.get("cwd") or str(Path.cwd())

    if tool == "Bash":
        reason = policy.check_bash(
            tool_input.get("command", ""),
            cwd,
            in_main_worktree=in_main_worktree(cwd),
        )
    elif tool in WRITE_TOOLS:
        reason = policy.check_file_write(write_targets(tool_input), cwd)
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
