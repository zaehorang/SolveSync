"""하네스가 공유하는 차단 규칙.

세 hook이 이 모듈을 import한다. codex PreToolUse, Claude Code PreToolUse, 그리고
git pre-commit이다. 규칙을 한 곳에만 두기 위해서다. 표준 라이브러리만 쓰고
부수효과를 두지 않는다. 순수한 판단 로직이며 harness/tests/test_policy.py가
검증한다. subprocess를 부르지 않으므로 git 상태 같은 바깥 사실은 호출자가
판정해서 인자로 넘긴다.

hook마다 상황이 다르므로 규칙에 실행 컨텍스트가 있다. CONTEXT_EXEC와
CONTEXT_INTERACTIVE를 보라.

차단 사유는 지시문으로 쓴다. hook이 `permissionDecisionReason`을 그대로 모델에게
돌려주므로, 무엇이 잘못됐는지가 아니라 대신 무엇을 하라고 적어야 한다.
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

# 실행 컨텍스트. 같은 규칙 집합을 두 상황이 공유한다.
#
# EXEC        codex가 하네스에게 받은 worktree 안에서만 도는 상황. 게시는
#             orchestrator가 전담하고 worktree 밖은 존재하지 않는 셈 친다.
# INTERACTIVE 사람이 붙어 있는 Claude Code 세션. 이슈를 만들고 worktree를 만들고
#             사용자가 승인하면 push도 한다. 그것이 워크플로우 자체다.
#
# 규칙을 두 벌로 복제하지 않고 컨텍스트를 인자로 받는다. 두 벌이 되면 반드시
# 어긋나고, 어긋난 쪽이 느슨하면 그게 gate의 실제 강도가 된다.
CONTEXT_EXEC = "exec"
CONTEXT_INTERACTIVE = "interactive"

# exec에서만 막는다. 대화형 세션에서는 전부 정상 작업이다. `gh issue`를 막으면
# 이슈 우선 워크플로우가, `git worktree`를 막으면 worktree 규칙 자체가 막힌다.
_EXEC_ONLY_DENY: tuple[tuple[tuple[str, ...], str], ...] = (
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
)

# 어느 컨텍스트에서도 막는다.
_ALWAYS_DENY: tuple[tuple[tuple[str, ...], str], ...] = (
    (
        ("npm", "publish"),
        "publish는 이 저장소의 작업이 아닙니다.",
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


def _is_inside(path: str, root: str) -> bool:
    root = os.path.normpath(root)
    return path == root or path.startswith(root + os.sep)


def _escapes_worktree(token: str, worktree: str, home: str) -> bool:
    """worktree 경계를 벗어나는 토큰이면 True.

    상대 경로도 검사한다. worktree는 `../<저장소이름>` 옆에 만들어지므로 `..`
    하나면 메인 체크아웃에 닿는다. apply_patch 쪽은 `../`를 막고 있었는데 여기만
    비어 있어 실제로 우회가 가능했다.
    """
    if token.startswith("~"):
        return not any(token.startswith(safe) for safe in _HOME_SAFE_PREFIXES)

    if token.startswith("/"):
        resolved = os.path.normpath(token)
        if _is_inside(resolved, worktree):
            return False
        # worktree 밖의 절대 경로 중 사용자 home만 막는다. /usr 같은 시스템 경로
        # 읽기까지 막으면 정상 작업이 걸린다.
        return resolved == home or resolved.startswith(os.path.normpath(home) + os.sep)

    # `..`이 없으면 worktree 기준으로 합쳐도 밖으로 나갈 수 없다.
    if ".." not in token.split("/"):
        return False
    return not _is_inside(os.path.normpath(os.path.join(worktree, token)), worktree)


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
    home: str | None = None,
    context: str = CONTEXT_EXEC,
    in_main_worktree: bool = False,
) -> str | None:
    """shell 명령의 차단 사유를 돌려준다. 허용이면 None.

    `in_main_worktree`는 호출자가 판정해서 넘긴다. 이 모듈은 subprocess를 부르지
    않는 순수 함수로 남는다.
    """
    home = home or os.path.expanduser("~")
    is_exec = context == CONTEXT_EXEC
    deny_prefixes = _ALWAYS_DENY + (_EXEC_ONLY_DENY if is_exec else ())

    for argv in _segments(command):
        head = tuple(argv[:2])
        for prefix, reason in deny_prefixes:
            if head[: len(prefix)] == prefix:
                return reason

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
                    "`git worktree add -b {type}/issue-{번호}-{slug} "
                    "../SolveSync-wt/{slug} main`으로 새 worktree를 만들어 거기서 작업하세요."
                )
            if is_exec and "main" in argv[2:]:
                return "작업 branch에 머무르세요. worktree 안에서 main을 checkout하지 않습니다."

        if argv[0] == "npm" and len(argv) > 1 and argv[1] in ("i", "install", "add"):
            if "-g" in argv or "--global" in argv:
                return "전역 설치는 허용되지 않습니다. worktree의 의존성만 사용하세요."

        # 대화형 세션은 scratchpad, memory, 다른 worktree를 정상적으로 오간다.
        # 경계는 worktree가 아니라 사용자의 의도이고 그건 hook이 판단할 수 없다.
        if is_exec:
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
    """codex apply_patch payload의 차단 사유를 돌려준다. 허용이면 None."""
    targets = patch_targets(patch)
    if not targets:
        return None

    reason = check_write_paths([path for _op, path in targets], worktree, CONTEXT_EXEC)
    if reason:
        return reason

    # 같은 patch 안에서 만들어지는 테스트는 이미 작성된 것으로 친다.
    created = {path for op, path in targets if op in ("Add", "Update")}
    written = [path for op, path in targets if op != "Delete"]
    return check_test_first(written, worktree, created)


# --- 파일 편집 --------------------------------------------------------------
#
# codex의 apply_patch와 Claude Code의 Write/Edit이 같은 규칙을 봐야 한다. 한쪽만
# 검사하면 그쪽이 아닌 경로로 들어온 편집에는 gate가 없는 것과 같고, 겉보기에는
# hook이 붙어 있으므로 없다는 사실조차 보이지 않는다.


def relative_to_worktree(path: str, worktree: str | Path) -> str | None:
    """worktree 기준 상대 경로. worktree 밖이면 None.

    Claude Code는 절대 경로를 넘기고 codex patch는 상대 경로를 넘긴다. 양쪽을
    같은 형태로 만들어 하나의 규칙으로 검사한다.
    """
    root = os.path.normpath(os.path.abspath(str(worktree)))
    target = os.path.normpath(os.path.abspath(os.path.join(root, os.path.expanduser(str(path)))))
    if not _is_inside(target, root):
        return None
    return normalize(os.path.relpath(target, root))


def check_write_paths(paths: list[str], worktree: str | Path, context: str = CONTEXT_EXEC) -> str | None:
    """편집 대상 경로 자체의 차단 사유. worktree 이탈과 금지 경로를 본다."""
    for path in paths:
        rel = relative_to_worktree(path, worktree)
        if rel is None:
            if context == CONTEXT_EXEC:
                return (
                    f"{path}은 worktree 밖입니다. 시작할 때 주어진 worktree 아래의 "
                    "파일만 편집하세요."
                )
            # 대화형 세션은 저장소 밖의 scratchpad와 memory를 정상적으로 쓴다.
            # 이 정책이 다루는 것은 저장소 안이다.
            continue
        reason = forbidden_path_reason(rel)
        if reason:
            return reason
    return None


def check_test_first(
    paths: list[str], worktree: str | Path, created: set[str] | frozenset[str] = frozenset()
) -> str | None:
    """로직 파일에 형제 테스트가 없으면 차단 사유를 돌려준다."""
    root = Path(worktree)
    for path in paths:
        rel = relative_to_worktree(path, worktree)
        if rel is None or not is_logic_source(rel):
            continue
        test_path = sibling_test_path(rel)
        if test_path in created or (root / test_path).exists():
            continue
        return (
            f"{rel}의 테스트를 먼저 작성하세요. {test_path}를 만들고 구현하려는 동작을 "
            "설명하는 실패 케이스를 넣은 뒤 구현하세요. src/shared와 src/background의 "
            "로직은 테스트 없이 작성할 수 없습니다."
        )
    return None


def check_file_write(
    paths: list[str], worktree: str | Path, context: str = CONTEXT_EXEC
) -> str | None:
    """파일을 쓰는 tool 호출의 차단 사유를 돌려준다. 허용이면 None."""
    reason = check_write_paths(paths, worktree, context)
    if reason:
        return reason
    return check_test_first(paths, worktree)


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
        "작업 중일 수 있습니다. `git worktree add -b {type}/issue-{번호}-{slug} "
        "../SolveSync-wt/{slug} main`으로 worktree를 만들고 거기서 작업하세요 (AGENTS.md)."
    )


# --- branch ------------------------------------------------------------------

BRANCH_TYPES = ("feat", "fix", "docs", "test", "refactor")

# `harness/cli.py`의 branch_name()이 만드는 형식과 같다. 두 곳이 어긋나면
# 하네스가 자기가 만든 branch에서 커밋하지 못하므로 cli가 이 값을 import한다.
# slug는 느슨하게 둔다. slug 형식 검증은 이 gate의 목적이 아니고, 좁히면
# 정상 branch를 막을 위험만 늘어난다.
_BRANCH_NAME = re.compile(rf"^(?:{'|'.join(BRANCH_TYPES)})/issue-\d+-[^/]+$")


def check_branch_name(branch: str) -> str | None:
    """work branch 이름의 차단 사유를 돌려준다. 허용이면 None.

    이슈 번호를 이름에 요구하는 것은 이슈 없이 시작한 작업을 늦게라도 막기
    위해서다. 커밋 시점 gate라 작업 시작은 막지 못한다.
    """
    if _BRANCH_NAME.match(branch.strip()):
        return None
    return (
        f"branch 이름 '{branch}'에 이슈 번호가 없습니다. 먼저 GitHub Issue를 "
        "만들고 {type}/issue-{번호}-{slug} 형식으로 branch를 다시 만드세요 "
        f"(type: {', '.join(BRANCH_TYPES)}). AGENTS.md의 Git Workflow를 따르세요."
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
