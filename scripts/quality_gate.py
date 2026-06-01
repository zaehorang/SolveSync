#!/usr/bin/env python3
"""SolveSync product quality gate."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent

COMMANDS = [
    ["npm", "run", "typecheck"],
    ["npm", "test"],
    ["npm", "run", "build"],
]


def _run(cmd: list[str]) -> int:
    cmd_text = " ".join(cmd)
    print(f"$ {cmd_text}", flush=True)
    try:
        return subprocess.run(cmd, cwd=ROOT).returncode
    except OSError as exc:
        print(f"quality_gate: unable to execute {cmd[0]}: {exc}", file=sys.stderr)
        return 1


def main() -> int:
    for cmd in COMMANDS:
        code = _run(cmd)
        if code != 0:
            print(f"quality_gate: command failed with exit code {code}", file=sys.stderr)
            return code

    print("quality_gate: passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
