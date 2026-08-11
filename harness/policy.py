"""Shared rules for the SolveSync agent harness.

Both the codex PreToolUse hook and the git pre-commit hook import this module,
so every rule lives in exactly one place. Keep this module dependency-free
(standard library only) and side-effect free: it is pure decision logic and is
covered by harness/tests/test_policy.py.

Deny reasons are written as instructions. The codex hook feeds
`permissionDecisionReason` straight back to the model, so the text has to tell
codex what to do instead, not just what went wrong.
"""

from __future__ import annotations

import os
import re
import shlex
from pathlib import Path, PurePosixPath

# --- paths ------------------------------------------------------------------

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
    """Repo-relative posix path with no leading ./ and no trailing slash."""
    text = str(path).strip().replace("\\", "/")
    while text.startswith("./"):
        text = text[2:]
    return text.rstrip("/")


def forbidden_path_reason(path: str) -> str | None:
    """Return a deny reason when `path` must never be written or committed."""
    rel = normalize(path)
    for prefix in FORBIDDEN_PREFIXES:
        if rel == prefix.rstrip("/") or rel.startswith(prefix):
            return (
                f"{rel} is a build/runtime artifact path ({prefix}). "
                "Do not create or commit files here."
            )
    base = PurePosixPath(rel).name
    if base.startswith(".env") and base not in ENV_ALLOWED:
        return (
            f"{rel} may contain secrets. Only .env.example belongs in the repository."
        )
    return None


def is_test_file(path: str) -> bool:
    return normalize(path).endswith(TEST_SUFFIX)


def is_logic_source(path: str) -> bool:
    """True for non-test TypeScript under the directories that require tests."""
    rel = normalize(path)
    if not rel.endswith(".ts") or is_test_file(rel):
        return False
    return rel.startswith(LOGIC_DIRS)


def sibling_test_path(path: str) -> str:
    """`src/shared/catalog.ts` -> `src/shared/catalog.test.ts`."""
    rel = normalize(path)
    return rel[: -len(".ts")] + TEST_SUFFIX


# --- secrets ----------------------------------------------------------------

SECRET_PATTERNS = (
    (re.compile(r"\bghp_[A-Za-z0-9]{20,}"), "GitHub personal access token"),
    (re.compile(r"\bgithub_pat_[A-Za-z0-9_]{20,}"), "GitHub fine-grained PAT"),
    (re.compile(r"\bgh[ousr]_[A-Za-z0-9]{20,}"), "GitHub OAuth/user/server token"),
    # A real bearer token is a long opaque string. Requiring that keeps prose
    # like "use an `Authorization: Bearer` header" from tripping the scanner,
    # which it did on this harness's own design document.
    (re.compile(r"Authorization:[ \t]*Bearer[ \t]+[A-Za-z0-9._\-]{20,}"), "Authorization header"),
)


def scan_secrets(text: str) -> list[tuple[str, str]]:
    """Return (label, matched-text) pairs for every secret-looking token."""
    found: list[tuple[str, str]] = []
    for pattern, label in SECRET_PATTERNS:
        for match in pattern.finditer(text):
            found.append((label, match.group(0)))
    return found


# --- shell commands ---------------------------------------------------------

_SPLIT_OPERATORS = re.compile(r"\|\||&&|[;\n|&]")
_ENV_ASSIGNMENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=")

_DENY_PREFIXES: tuple[tuple[tuple[str, ...], str], ...] = (
    (
        ("git", "push"),
        "Pushing is the orchestrator's job. Commit your work and stop; "
        "the harness pushes and opens the pull request.",
    ),
    (
        ("git", "config"),
        "Do not change git configuration. The harness owns core.hooksPath "
        "and the gate it points at.",
    ),
    (
        ("git", "worktree"),
        "Do not manage worktrees. Work only inside the worktree you were started in.",
    ),
    (
        ("gh", "pr"),
        "Pull requests are created by the orchestrator, not from inside exec.",
    ),
    (
        ("gh", "issue"),
        "Issue updates are made by the orchestrator, not from inside exec.",
    ),
    (
        ("gh", "api"),
        "Do not call the GitHub API from exec. Report what you need instead.",
    ),
    (
        ("npm", "publish"),
        "Publishing is never part of solving an issue.",
    ),
)

_HOME_SAFE_PREFIXES = ("~/.cache/", "~/.npm/")


def _segments(command: str):
    """Split a shell command into argv lists, one per pipeline/list element."""
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
    """True when a token points at the user's home outside the worktree."""
    if token.startswith("~"):
        return not any(token.startswith(safe) for safe in _HOME_SAFE_PREFIXES)
    if not token.startswith("/"):
        return False
    resolved = os.path.normpath(token)
    if resolved.startswith(os.path.normpath(worktree) + os.sep):
        return False
    return resolved == home or resolved.startswith(os.path.normpath(home) + os.sep)


def check_bash(command: str, worktree: str, home: str | None = None) -> str | None:
    """Return a deny reason for a shell command, or None to allow it."""
    home = home or os.path.expanduser("~")
    for argv in _segments(command):
        head = tuple(argv[:2])
        for prefix, reason in _DENY_PREFIXES:
            if head[: len(prefix)] == prefix:
                return reason

        if argv[0] == "git" and "commit" in argv[:3]:
            if any(flag in argv for flag in ("--no-verify", "-n")):
                return (
                    "Do not bypass the pre-commit gate. If it blocks the commit, "
                    "fix what it reported and commit again."
                )

        if argv[0] == "git" and head[:2] in (("git", "checkout"), ("git", "switch")):
            if "main" in argv[2:]:
                return (
                    "Stay on the work branch. Never check out main inside a worktree."
                )

        if argv[0] == "npm" and len(argv) > 1 and argv[1] in ("i", "install", "add"):
            if "-g" in argv or "--global" in argv:
                return "Global installs are not allowed. Use the worktree's own dependencies."

        for token in argv[1:]:
            if _escapes_worktree(token, worktree, home):
                return (
                    f"{token} is outside the worktree. Every file you touch must live "
                    "under the worktree you were started in."
                )
    return None


# --- apply_patch ------------------------------------------------------------

_PATCH_FILE = re.compile(r"^\*\*\*\s+(Add|Update|Delete)\s+File:\s*(.+?)\s*$", re.M)
_PATCH_MOVE = re.compile(r"^\*\*\*\s+Move\s+to:\s*(.+?)\s*$", re.M)


def patch_targets(patch: str) -> list[tuple[str, str]]:
    """Extract (operation, path) pairs from an apply_patch payload."""
    targets = [(op, normalize(path)) for op, path in _PATCH_FILE.findall(patch)]
    targets += [("Add", normalize(path)) for path in _PATCH_MOVE.findall(patch)]
    return targets


def check_apply_patch(patch: str, worktree: str | Path) -> str | None:
    """Return a deny reason for a file edit, or None to allow it."""
    root = Path(worktree)
    targets = patch_targets(patch)
    if not targets:
        return None

    added = {path for op, path in targets if op in ("Add", "Update")}

    for _op, path in targets:
        if path.startswith("/") or path.startswith("../") or "/../" in path:
            return (
                f"{path} is outside the worktree. Only edit files under the worktree "
                "you were started in."
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
            f"Write the test for {path} first. Create {test_path} with a failing case "
            "that describes the behaviour you are about to implement, then implement it. "
            "Logic under src/shared and src/background may not be written without a test."
        )
    return None


# --- staged changes ---------------------------------------------------------


def check_staged_paths(paths: list[str]) -> list[str]:
    """Return deny reasons for staged paths that must never be committed."""
    problems = []
    for path in paths:
        reason = forbidden_path_reason(path)
        if reason:
            problems.append(reason)
    return problems
