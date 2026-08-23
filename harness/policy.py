"""하네스가 공유하는 차단 규칙.

두 hook이 이 모듈을 import한다. Claude Code PreToolUse와 git pre-commit이다.
규칙을 한 곳에만 두기 위해서다. 표준 라이브러리만 쓰고 부수효과를 두지 않는다.
순수한 판단 로직이며 harness/tests/test_policy.py가 검증한다. subprocess를
부르지 않으므로 git 상태 같은 바깥 사실은 호출자가 판정해서 인자로 넘긴다.

두 hook이 서는 자리가 다르다. PreToolUse는 도구 호출 전에 막고, pre-commit은
커밋 시점에 막는다. pre-commit 쪽이 최후 방어선이다. 누가 커밋하든, 어떤 도구를
거쳤든 걸린다.

차단 사유는 지시문으로 쓴다. hook이 `permissionDecisionReason`을 그대로 모델에게
돌려주므로, 무엇이 잘못됐는지가 아니라 대신 무엇을 하라고 적어야 한다.
"""

from __future__ import annotations

import os
import re
import shlex
from pathlib import Path, PurePosixPath

# --- 경로 --------------------------------------------------------------------

FORBIDDEN_PREFIXES = (
    "dist/",
    "node_modules/",
    "coverage/",
    "artifacts/",
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


def _is_inside(path: str, root: str) -> bool:
    root = os.path.normpath(root)
    return path == root or path.startswith(root + os.sep)


def _is_branch_switch(argv: list[str]) -> bool:
    """이 명령이 checkout 중인 branch를 바꾸는가.

    `git switch`는 언제나 branch 조작이다. `git checkout`은 파일 복원에도 쓰이는데
    `--`로 경로를 명시한 형태만 파일 복원으로 본다. 애매하면 막는 쪽을 고른다.
    파일 복원은 `git restore`가 있고 그쪽은 막지 않는다.
    """
    if len(argv) < 2 or argv[0] != "git":
        return False
    if argv[1] == "switch":
        return True
    return argv[1] == "checkout" and "--" not in argv[2:]


def check_bash(
    command: str,
    worktree: str,
    in_main_worktree: bool = False,
) -> str | None:
    """shell 명령의 차단 사유를 돌려준다. 허용이면 None.

    `in_main_worktree`는 호출자가 판정해서 넘긴다. 이 모듈은 subprocess를 부르지
    않는 순수 함수로 남는다.

    게시(`git push`, `gh pr`, `gh issue`)와 저장소 밖 경로는 막지 않는다. 대화형
    세션에서는 그것이 정상 작업이다. worktree를 만들고 사용자가 승인하면
    push하는 것이 워크플로우 자체다.
    """
    for argv in _segments(command):
        if argv[0] == "git" and "commit" in argv[:3]:
            if any(flag in argv for flag in ("--no-verify", "-n")):
                return (
                    "pre-commit gate를 우회하지 마세요. gate가 커밋을 막았다면 "
                    "막은 이유를 고치고 다시 커밋하세요."
                )

        if _is_branch_switch(argv):
            if in_main_worktree:
                return (
                    "주 작업 디렉터리의 branch를 갈아타지 마세요. 다른 세션이 그 "
                    "디렉터리에서 작업 중일 수 있고, 그 작업이 조용히 깨집니다. "
                    "`git worktree add -b {type}/{slug} "
                    "../SolveSync-wt/{slug} main`으로 새 worktree를 만들어 거기서 작업하세요."
                )

        if argv[0] == "npm" and len(argv) > 1 and argv[1] in ("i", "install", "add"):
            if "-g" in argv or "--global" in argv:
                return "전역 설치는 허용되지 않습니다. worktree의 의존성만 사용하세요."
    return None


# --- 파일 편집 --------------------------------------------------------------


def relative_to_worktree(path: str, worktree: str | Path) -> str | None:
    """worktree 기준 상대 경로. worktree 밖이면 None."""
    root = os.path.normpath(os.path.abspath(str(worktree)))
    target = os.path.normpath(os.path.abspath(os.path.join(root, os.path.expanduser(str(path)))))
    if not _is_inside(target, root):
        return None
    return normalize(os.path.relpath(target, root))


def check_file_write(paths: list[str], worktree: str | Path) -> str | None:
    """파일을 쓰는 tool 호출의 차단 사유를 돌려준다. 허용이면 None.

    저장소 밖의 경로는 막지 않는다. 대화형 세션은 저장소 밖의 scratchpad와
    memory를 정상적으로 쓴다. 이 정책이 다루는 것은 저장소 안이다.
    """
    for path in paths:
        rel = relative_to_worktree(path, worktree)
        if rel is None:
            continue
        reason = forbidden_path_reason(rel)
        if reason:
            return reason
    return None


# --- worktree ----------------------------------------------------------------


def check_worktree_isolation(git_dir: str, git_common_dir: str) -> str | None:
    """주 worktree에서의 커밋 차단 사유를 돌려준다. linked worktree면 None.

    linked worktree는 `--git-dir`가 `.git/worktrees/<이름>`이고 `--git-common-dir`가
    `.git`이다. 주 worktree는 둘이 같다. git이 계산해주는 값이라 판정이 결정적이고
    값싸다.
    """
    if os.path.abspath(git_dir) != os.path.abspath(git_common_dir):
        return None
    return (
        "주 작업 디렉터리에서는 커밋할 수 없습니다. 다른 세션이 이 디렉터리에서 "
        "작업 중일 수 있습니다. `git worktree add -b {type}/{slug} "
        "../SolveSync-wt/{slug} main`으로 worktree를 만들고 거기서 작업하세요 (CLAUDE.md)."
    )


# --- branch ------------------------------------------------------------------

BRANCH_TYPES = ("feat", "fix", "docs", "test", "refactor", "chore", "ci")

# CLAUDE.md의 Git Workflow가 안내하는 형식과 같아야 한다. 어긋나면 문서대로
# 만든 branch에서 커밋하지 못한다.
# slug는 느슨하게 둔다. slug 형식 검증은 이 gate의 목적이 아니고, 좁히면
# 정상 branch를 막을 위험만 늘어난다. 이슈 번호도 요구하지 않는다. 이슈는
# 선택이고, 이름에 번호가 든 기존 branch는 slug의 일부로 그대로 통과한다.
_BRANCH_NAME = re.compile(rf"^(?:{'|'.join(BRANCH_TYPES)})/[^/]+$")

_BRANCH_FORM = "{type}/{slug}"


def check_branch_name(branch: str) -> str | None:
    """work branch 이름의 차단 사유를 돌려준다. 허용이면 None.

    type 접두사만 요구한다. history에서 변경의 성격을 읽을 수 있게 하는 값싼
    규칙이다.

    실패 사유를 구분해서 돌려준다. 하나로 뭉뚱그리면 틀린 지시를 하게 된다.
    gate가 사람을 잘못된 방향으로 보내면 없느니만 못하다.
    """
    name = branch.strip()

    if _BRANCH_NAME.match(name):
        return None

    types = ", ".join(BRANCH_TYPES)
    prefix, separator, rest = name.partition("/")

    if not separator:
        return (
            f"branch 이름 '{branch}'에 type이 없습니다. {_BRANCH_FORM} 형식으로 "
            f"다시 만드세요 (type: {types}). CLAUDE.md의 Git Workflow를 따르세요."
        )

    if prefix not in BRANCH_TYPES:
        return (
            f"branch type '{prefix}'는 쓸 수 없습니다. {types} 중에서 고르고 "
            f"{_BRANCH_FORM} 형식으로 branch를 다시 만드세요. "
            "CLAUDE.md의 Git Workflow를 따르세요."
        )

    return (
        f"branch 이름 '{branch}'의 slug가 형식에 맞지 않습니다. type 뒤에 "
        f"`/` 없는 kebab-case slug를 붙여 {_BRANCH_FORM} 형식으로 만드세요. "
        "CLAUDE.md의 Git Workflow를 따르세요."
    )


# --- staged 변경 --------------------------------------------------------------


def check_staged_paths(paths: list[str]) -> list[str]:
    """커밋하면 안 되는 staged 경로들의 차단 사유를 돌려준다."""
    problems = []
    for path in paths:
        reason = forbidden_path_reason(path)
        if reason:
            problems.append(reason)
    return problems
