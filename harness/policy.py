"""하네스가 공유하는 차단 규칙.

codex PreToolUse hook과 git pre-commit hook이 모두 이 모듈을 import한다. 규칙을
한 곳에만 두기 위해서다. 표준 라이브러리만 쓰고 부수효과를 두지 않는다. 순수한
판단 로직이며 harness/tests/test_policy.py가 검증한다.

차단 사유는 지시문으로 쓴다. codex hook이 `permissionDecisionReason`을 그대로
모델에게 돌려주므로, 무엇이 잘못됐는지가 아니라 대신 무엇을 하라고 적어야 한다.
"""

from __future__ import annotations

import os
import re
import shlex
from pathlib import Path, PurePosixPath

# --- 경로 --------------------------------------------------------------------

LOGIC_DIRS = ("src/shared/", "src/background/")
TEST_SUFFIX = ".test.ts"

FORBIDDEN_PREFIXES = (
    "dist/",
    "node_modules/",
    "coverage/",
    "artifacts/",
    ".harness/",
)

ENV_ALLOWED = (".env.example",)


def normalize(path: str) -> str:
    """저장소 기준 posix 경로. 앞의 ./와 뒤의 /를 제거한다."""
    text = str(path).strip().replace("\\", "/")
    while text.startswith("./"):
        text = text[2:]
    return text.rstrip("/")


def forbidden_path_reason(path: str) -> str | None:
    """절대 쓰거나 커밋하면 안 되는 경로면 차단 사유를 돌려준다."""
    rel = normalize(path)
    for prefix in FORBIDDEN_PREFIXES:
        if rel == prefix.rstrip("/") or rel.startswith(prefix):
            return (
                f"{rel}은 build/runtime 산출물 경로({prefix})입니다. "
                "여기에 파일을 만들거나 커밋하지 마세요."
            )
    base = PurePosixPath(rel).name
    if base.startswith(".env") and base not in ENV_ALLOWED:
        return f"{rel}에는 secret이 들어갈 수 있습니다. 저장소에는 .env.example만 둡니다."
    return None


def is_test_file(path: str) -> bool:
    return normalize(path).endswith(TEST_SUFFIX)


def is_logic_source(path: str) -> bool:
    """테스트가 필수인 디렉터리의 비테스트 TypeScript 파일인지 판단한다."""
    rel = normalize(path)
    if not rel.endswith(".ts") or is_test_file(rel):
        return False
    return rel.startswith(LOGIC_DIRS)


def sibling_test_path(path: str) -> str:
    """`src/shared/catalog.ts` -> `src/shared/catalog.test.ts`."""
    rel = normalize(path)
    return rel[: -len(".ts")] + TEST_SUFFIX


# --- secret ------------------------------------------------------------------

SECRET_PATTERNS = (
    (re.compile(r"\bghp_[A-Za-z0-9]{20,}"), "GitHub personal access token"),
    (re.compile(r"\bgithub_pat_[A-Za-z0-9_]{20,}"), "GitHub fine-grained PAT"),
    (re.compile(r"\bgh[ousr]_[A-Za-z0-9]{20,}"), "GitHub OAuth/user/server token"),
    # 실제 bearer token은 길고 불투명한 문자열이다. 길이를 요구해야 "`Authorization:
    # Bearer` header를 쓴다" 같은 산문이 걸리지 않는다. 이 하네스의 설계 문서가
    # 실제로 이 오탐에 막혔다.
    (re.compile(r"Authorization:[ \t]*Bearer[ \t]+[A-Za-z0-9._\-]{20,}"), "Authorization header"),
)


def scan_secrets(text: str) -> list[tuple[str, str]]:
    """secret으로 보이는 토큰마다 (분류, 일치한 문자열) 쌍을 돌려준다."""
    found: list[tuple[str, str]] = []
    for pattern, label in SECRET_PATTERNS:
        for match in pattern.finditer(text):
            found.append((label, match.group(0)))
    return found


# --- shell 명령 ---------------------------------------------------------------

_SPLIT_OPERATORS = re.compile(r"\|\||&&|[;\n|&]")
_ENV_ASSIGNMENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=")

_DENY_PREFIXES: tuple[tuple[tuple[str, ...], str], ...] = (
    (
        ("git", "push"),
        "push는 orchestrator의 일입니다. 커밋까지만 하고 멈추세요. "
        "push와 Pull Request 생성은 하네스가 합니다.",
    ),
    (
        ("git", "config"),
        "git 설정을 바꾸지 마세요. core.hooksPath와 그것이 가리키는 gate는 하네스가 관리합니다.",
    ),
    (
        ("git", "worktree"),
        "worktree를 직접 다루지 마세요. 시작할 때 주어진 worktree 안에서만 작업합니다.",
    ),
    (
        ("gh", "pr"),
        "Pull Request는 exec 안에서가 아니라 orchestrator가 생성합니다.",
    ),
    (
        ("gh", "issue"),
        "Issue 갱신은 exec 안에서가 아니라 orchestrator가 합니다.",
    ),
    (
        ("gh", "api"),
        "exec에서 GitHub API를 호출하지 마세요. 필요한 것이 있으면 그 사실을 보고하세요.",
    ),
    (
        ("npm", "publish"),
        "publish는 이슈 해결의 일부가 아닙니다.",
    ),
)

_HOME_SAFE_PREFIXES = ("~/.cache/", "~/.npm/")


def _segments(command: str):
    """shell 명령을 pipeline/list 요소 단위의 argv 목록으로 나눈다."""
    for raw in _SPLIT_OPERATORS.split(command):
        raw = raw.strip()
        if not raw:
            continue
        try:
            argv = shlex.split(raw)
        except ValueError:
            argv = raw.split()
        while argv and (_ENV_ASSIGNMENT.match(argv[0]) or argv[0] in ("sudo", "command", "time")):
            argv = argv[1:]
        if argv:
            yield argv


def _escapes_worktree(token: str, worktree: str, home: str) -> bool:
    """worktree 밖의 home을 가리키는 토큰이면 True."""
    if token.startswith("~"):
        return not any(token.startswith(safe) for safe in _HOME_SAFE_PREFIXES)
    if not token.startswith("/"):
        return False
    resolved = os.path.normpath(token)
    if resolved.startswith(os.path.normpath(worktree) + os.sep):
        return False
    return resolved == home or resolved.startswith(os.path.normpath(home) + os.sep)


def check_bash(command: str, worktree: str, home: str | None = None) -> str | None:
    """shell 명령의 차단 사유를 돌려준다. 허용이면 None."""
    home = home or os.path.expanduser("~")
    for argv in _segments(command):
        head = tuple(argv[:2])
        for prefix, reason in _DENY_PREFIXES:
            if head[: len(prefix)] == prefix:
                return reason

        if argv[0] == "git" and "commit" in argv[:3]:
            if any(flag in argv for flag in ("--no-verify", "-n")):
                return (
                    "pre-commit gate를 우회하지 마세요. gate가 커밋을 막았다면 "
                    "막은 이유를 고치고 다시 커밋하세요."
                )

        if argv[0] == "git" and head[:2] in (("git", "checkout"), ("git", "switch")):
            if "main" in argv[2:]:
                return "작업 branch에 머무르세요. worktree 안에서 main을 checkout하지 않습니다."

        if argv[0] == "npm" and len(argv) > 1 and argv[1] in ("i", "install", "add"):
            if "-g" in argv or "--global" in argv:
                return "전역 설치는 허용되지 않습니다. worktree의 의존성만 사용하세요."

        for token in argv[1:]:
            if _escapes_worktree(token, worktree, home):
                return (
                    f"{token}은 worktree 밖입니다. 건드리는 모든 파일은 "
                    "시작할 때 주어진 worktree 안에 있어야 합니다."
                )
    return None


# --- apply_patch --------------------------------------------------------------

_PATCH_FILE = re.compile(r"^\*\*\*\s+(Add|Update|Delete)\s+File:\s*(.+?)\s*$", re.M)
_PATCH_MOVE = re.compile(r"^\*\*\*\s+Move\s+to:\s*(.+?)\s*$", re.M)


def patch_targets(patch: str) -> list[tuple[str, str]]:
    """apply_patch payload에서 (연산, 경로) 쌍을 뽑는다."""
    targets = [(op, normalize(path)) for op, path in _PATCH_FILE.findall(patch)]
    targets += [("Add", normalize(path)) for path in _PATCH_MOVE.findall(patch)]
    return targets


def check_apply_patch(patch: str, worktree: str | Path) -> str | None:
    """파일 편집의 차단 사유를 돌려준다. 허용이면 None."""
    root = Path(worktree)
    targets = patch_targets(patch)
    if not targets:
        return None

    added = {path for op, path in targets if op in ("Add", "Update")}

    for _op, path in targets:
        if path.startswith("/") or path.startswith("../") or "/../" in path:
            return (
                f"{path}은 worktree 밖입니다. 시작할 때 주어진 worktree 아래의 파일만 편집하세요."
            )
        reason = forbidden_path_reason(path)
        if reason:
            return reason

    for op, path in targets:
        if op == "Delete" or not is_logic_source(path):
            continue
        test_path = sibling_test_path(path)
        if test_path in added or (root / test_path).exists():
            continue
        return (
            f"{path}의 테스트를 먼저 작성하세요. {test_path}를 만들고 구현하려는 동작을 "
            "설명하는 실패 케이스를 넣은 뒤 구현하세요. src/shared와 src/background의 "
            "로직은 테스트 없이 작성할 수 없습니다."
        )
    return None


# --- staged 변경 --------------------------------------------------------------


def check_staged_paths(paths: list[str]) -> list[str]:
    """커밋하면 안 되는 staged 경로들의 차단 사유를 돌려준다."""
    problems = []
    for path in paths:
        reason = forbidden_path_reason(path)
        if reason:
            problems.append(reason)
    return problems
