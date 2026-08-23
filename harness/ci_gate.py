#!/usr/bin/env python3
"""CI gate. hook이 설치되지 않은 checkout에서 만들어진 변경을 CI가 다시 본다.

`core.hooksPath`는 clone마다 사람이 켜는 opt-in이고, git은 설정이 없는 저장소에서
경고 없이 hook을 건너뛴다. 그래서 pre-commit이 한 번도 돌지 않은 커밋이 PR로
올라올 수 있다.

여기서 다시 보는 것은 되돌릴 수 없는 둘뿐이다. secret은 공개 저장소에 한 번
올라가면 회수되지 않고, 산출물 경로는 조용히 누적된다. branch 이름처럼 되돌릴 수
있는 것은 다시 보지 않는다. 규칙은 `policy.py` 하나이고 이 파일은 CI에 그것을
붙이는 얇은 adapter다.

**커밋 하나씩 본다.** 범위 전체의 net diff를 보면 한 커밋에서 넣었다가 다음
커밋에서 지운 secret이 사라진다. 지웠어도 그 값은 이미 push된 history에 남아
있으므로 회수가 필요하다. 같은 이유로 push 범위의 마지막 커밋만 보지 않는다.

    python3 harness/ci_gate.py <base-ref>
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import policy  # noqa: E402


def fail(message: str) -> None:
    print(f"ci-gate: {message}", file=sys.stderr)
    sys.exit(1)


def git(*args: str) -> str:
    """답을 얻지 못하면 실패하는 git 호출. 범위를 모르는 gate는 gate가 아니다."""
    result = subprocess.run(["git", *args], capture_output=True, text=True)
    if result.returncode != 0:
        fail(f"git {' '.join(args)} 실패: {result.stderr.strip()}")
    return result.stdout


def added_lines(patch: str) -> str:
    """patch에서 추가된 줄의 내용만 남긴다.

    삭제된 줄까지 보면 base에 이미 있던 secret을 지우는 커밋이 차단된다. 정리하는
    쪽을 막는 gate는 사람을 잘못된 방향으로 보낸다.

    hunk 안인지 보고 판단한다. prefix만 보면 `++counter;` 같은 소스 줄이 `+++`로
    시작해 파일 header와 함께 버려지고, 그 줄에 secret이 있어도 통과한다.

    combined diff는 부모 수만큼 marker column을 쓴다. hunk header의 `@` 개수가 그
    폭을 알려주므로 폭을 따로 넘겨받지 않는다.
    """
    contents: list[str] = []
    width = 0
    for line in patch.splitlines():
        if line.startswith("@@"):
            width = len(line) - len(line.lstrip("@")) - 1
            continue
        if width == 0 or line.startswith("diff "):
            # hunk 밖이다. `diff --git`, index와 `+++ b/...` header가 여기 걸린다.
            width = 0
            continue
        if "+" in line[:width]:
            contents.append(line[width:])
    return "\n".join(contents)


def main() -> None:
    if len(sys.argv) != 2:
        fail("base ref를 하나 받아야 합니다. 예: python3 harness/ci_gate.py origin/main")
    base = sys.argv[1]

    resolved = subprocess.run(
        ["git", "rev-parse", "--verify", "--quiet", f"{base}^{{commit}}"],
        capture_output=True,
        text=True,
    )
    if resolved.returncode != 0:
        fail(
            f"base ref '{base}'를 찾을 수 없습니다. 검사 범위를 모르면 통과시키지 않습니다. "
            "checkout의 fetch 깊이와 workflow가 넘긴 ref를 확인하세요."
        )

    commits = git("rev-list", "--reverse", f"{base}..HEAD").split()
    if not commits:
        print(f"ci-gate: {base} 이후 새 커밋이 없습니다.")
        return

    problems: list[str] = []
    for sha in commits:
        short = sha[:9]
        # `-z`로 받는다. quotePath 기본값에서 비ASCII 경로는 `"dist/\355..."`처럼
        # C-style로 quote되어 돌아오고, 그러면 `dist/` prefix 검사를 그냥 지나간다.
        changed = [
            p
            for p in git(
                "diff-tree", "--no-commit-id", "--name-only", "-r", "-c", "-z",
                "--diff-filter=ACMR", sha,
            ).split("\0")
            if p
        ]
        problems += [f"{short}: {reason}" for reason in policy.check_staged_paths(changed)]

        # merge 커밋은 `-c` 없이는 경로도 patch도 내지 않는다. 충돌을 해결하면서
        # 어느 부모에도 없던 값을 새로 적을 수 있으므로 그 구간을 봐야 한다.
        # 일반 커밋에서 `-c`는 아무것도 바꾸지 않는다.
        # 경로 문자열도 함께 본다. token을 파일 이름으로 커밋하면 내용 scan에는
        # 걸리지 않는다. pre-commit은 header가 포함된 diff 전체를 훑어서 잡는다.
        secrets = policy.scan_secrets(
            "\n".join(
                [added_lines(git("diff-tree", "--no-commit-id", "-p", "-U0", "-r", "-c", sha))]
                + changed
            )
        )
        if secrets:
            labels = ", ".join(sorted({label for label, _ in secrets}))
            problems.append(
                f"{short}: 커밋에 secret으로 보이는 값이 있습니다 ({labels}). "
                "값을 회수하고 history에서 제거하세요."
            )

    for problem in problems:
        print(f"ci-gate: {problem}", file=sys.stderr)
    if problems:
        sys.exit(1)

    print(f"ci-gate: 커밋 {len(commits)}개를 검사했고 문제가 없습니다.")


if __name__ == "__main__":
    main()
