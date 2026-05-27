#!/usr/bin/env python3
"""
Codex Harness 품질 검증기.

package.json, Python 테스트, Package.swift를 감지해 대상 프로젝트에 이미 선언된
typecheck/lint/test/build 계열 명령만 실행한다. 검증 명령이 없으면 실패가 아니라 skip으로
처리해 여러 종류의 프로젝트에 그대로 복사해 쓸 수 있게 한다.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


def _run(cmd: list[str]) -> int:
    print(f"$ {' '.join(cmd)}", flush=True)
    result = subprocess.run(cmd, cwd=ROOT)
    return result.returncode


def _node_package_manager() -> list[str] | None:
    if (ROOT / "pnpm-lock.yaml").exists() and shutil.which("pnpm"):
        return ["pnpm"]
    if (ROOT / "yarn.lock").exists() and shutil.which("yarn"):
        return ["yarn"]
    if (ROOT / "package-lock.json").exists() and shutil.which("npm"):
        return ["npm"]
    if (ROOT / "package.json").exists() and shutil.which("npm"):
        return ["npm"]
    return None


def _node_commands() -> list[list[str]]:
    package_json = ROOT / "package.json"
    if not package_json.exists():
        return []

    try:
        data = json.loads(package_json.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        print("ERROR: package.json is not valid JSON", file=sys.stderr)
        return [["__invalid_package_json__"]]

    scripts = data.get("scripts") or {}
    manager = _node_package_manager()
    if manager is None:
        return []

    commands: list[list[str]] = []
    for name in ("typecheck", "lint", "test", "build"):
        if name not in scripts:
            continue
        if manager[0] == "npm":
            commands.append(["npm", "run", name])
        else:
            commands.append(manager + [name])
    return commands


def _python_commands() -> list[list[str]]:
    has_python_project = any(
        (ROOT / name).exists()
        for name in ("pyproject.toml", "pytest.ini", "setup.cfg", "tox.ini")
    )
    has_tests = (ROOT / "tests").is_dir() or any((ROOT / "scripts").glob("test_*.py"))
    if not has_python_project and not has_tests:
        return []

    commands: list[list[str]] = []
    if shutil.which("ruff"):
        commands.append(["ruff", "check", "."])

    can_import_pytest = subprocess.run(
        [sys.executable, "-c", "import pytest"],
        cwd=ROOT,
        capture_output=True,
        text=True,
    ).returncode == 0
    if can_import_pytest and has_tests:
        commands.append([sys.executable, "-m", "pytest"])
    return commands


def _swift_commands() -> list[list[str]]:
    if (ROOT / "Package.swift").exists() and shutil.which("swift"):
        return [["swift", "test"]]
    return []


def main() -> int:
    commands = _node_commands() + _python_commands() + _swift_commands()

    if any(cmd == ["__invalid_package_json__"] for cmd in commands):
        return 1

    if not commands:
        print("quality_gate: no supported validation commands detected; skipping.")
        return 0

    for cmd in commands:
        code = _run(cmd)
        if code != 0:
            print(f"quality_gate: command failed with exit code {code}", file=sys.stderr)
            return code

    print("quality_gate: passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
