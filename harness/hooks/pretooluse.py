#!/usr/bin/env python3
"""Codex PreToolUse hook.

Registered from the main repository's .codex/config.toml with a relative
command path, so each worktree runs the copy checked out on its own branch.

Reads the hook payload on stdin and either stays silent (allow) or prints a
deny decision. Any failure inside this script denies the tool call: a gate that
opens when it crashes is not a gate.
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
            }
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
    except Exception as error:  # fail closed
        deny(
            "The harness policy hook failed and therefore denied this call "
            f"({type(error).__name__}: {error}). Report this instead of retrying."
        )
