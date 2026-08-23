#!/usr/bin/env python3
"""CI gate. hook이 설치되지 않은 checkout에서 만들어진 변경을 CI가 다시 본다.

`core.hooksPath`는 clone마다 사람이 켜는 opt-in이고, git은 설정이 없는 저장소에서
경고 없이 hook을 건너뛴다. 그래서 pre-commit이 한 번도 돌지 않은 커밋이 PR로
올라올 수 있다.

여기서 다시 보는 것은 되돌릴 수 없는 둘뿐이다. secret은 공개 저장소에 한 번
올라가면 회수되지 않고, 산출물 경로는 조용히 누적된다. branch 이름처럼 되돌릴 수
있는 것은 다시 보지 않는다. 규칙은 `policy.py` 하나이고 이 파일은 CI에 그것을
붙이는 얇은 adapter다.

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


def main() -> None:
    if len(sys.argv) != 2:
        fail("base ref를 하나 받아야 합니다. 예: python3 harness/ci_gate.py origin/main")
    # 세 점은 merge base부터 본다. base branch가 앞서 나가도 이 PR이 실제로 더한
    # 변경만 검사한다.
    base = f"{sys.argv[1]}...HEAD"

    changed = [p for p in git("diff", "--name-only", "--diff-filter=ACMR", base).splitlines() if p]
    if not changed:
        print("ci-gate: 검사할 변경이 없습니다.")
        return

    problems = policy.check_staged_paths(changed)

    secrets = policy.scan_secrets(git("diff", "-U0", base))
    if secrets:
        labels = ", ".join(sorted({label for label, _ in secrets}))
        problems.append(f"변경에 secret으로 보이는 값이 있습니다 ({labels}). 값을 회수하고 history에서 제거하세요.")

    for problem in problems:
        print(f"ci-gate: {problem}", file=sys.stderr)
    if problems:
        sys.exit(1)

    print(f"ci-gate: {len(changed)}개 파일을 검사했고 문제가 없습니다.")


if __name__ == "__main__":
    main()
