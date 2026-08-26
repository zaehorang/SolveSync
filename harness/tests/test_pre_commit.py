"""pre-commit hook의 staged 목록 해석 회귀 테스트.

`policy.py`는 순수 함수라 값만 넣으면 되지만 hook은 git이 내주는 형식을 직접
해석한다. 이 해석이 어긋나면 gate는 정상적인 commit을 막거나, 반대로 하네스
변경을 검증 없이 통과시킨다. 둘 다 조용히 일어난다.

전체 검증(typecheck·test·build)까지 돌리면 테스트가 분 단위가 되므로, 여기서는
그 앞 단계까지만 확인한다. `package.json`이 없는 임시 저장소에서 hook을 돌리면
staged 해석을 지나 npm 단계에서 실패하므로, "어디에서 실패했는가"로 해석이
맞았는지 판정할 수 있다.
"""

from __future__ import annotations

import os
import subprocess
import tempfile
import unittest
from pathlib import Path

PRE_COMMIT = Path(__file__).resolve().parent.parent / "hooks" / "pre-commit"

# test_ci_gate와 같은 이유다. git이 hook 실행 시 내보내는 GIT_*를 물려받으면
# `cwd`가 무시되고 실제 저장소가 조작된다.
GIT_FREE_ENV = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}

EMPTY = "staged 변경이 없습니다."


class PreCommitRepo:
    """work branch worktree에 체크아웃된 임시 저장소.

    주 작업 디렉터리가 아니라 worktree여야 한다. hook이 staged를 보기 전에
    worktree 격리부터 확인하므로, `git init` 저장소에서 그냥 돌리면 그 앞에서
    막혀 staged 해석은 실행조차 되지 않는다.
    """

    def __init__(self, tmp: Path) -> None:
        self.main = tmp / "main"
        self.main.mkdir(parents=True)
        self.root = tmp / "wt"

        self._git(self.main, "init", "-q", "-b", "main")
        self._git(self.main, "config", "user.email", "harness@example.com")
        self._git(self.main, "config", "user.name", "harness")
        (self.main / "seed.txt").write_text("seed\n", encoding="utf-8")
        self._git(self.main, "add", "-A")
        self._git(self.main, "commit", "-q", "-m", "base")
        self._git(self.main, "worktree", "add", "-q", "-b", "chore/fixture", str(self.root), "main")
        self._assert_isolated()

    def _assert_isolated(self) -> None:
        """환경이 새면 아래 테스트가 실제 저장소를 건드리고도 통과한다."""
        top = self.git("rev-parse", "--show-toplevel").strip()
        if not top or Path(top).resolve() != self.root.resolve():
            raise AssertionError(
                f"테스트 저장소가 격리되지 않았습니다. toplevel={top!r} root={self.root!r}. "
                "git이 내보낸 GIT_* 환경변수가 새는지 확인하세요."
            )

    @staticmethod
    def _git(cwd: Path, *args: str) -> str:
        result = subprocess.run(
            ["git", *args],
            cwd=cwd,
            env=GIT_FREE_ENV,
            capture_output=True,
            text=True,
        )
        return result.stdout

    def git(self, *args: str) -> str:
        return self._git(self.root, *args)

    def write(self, relative: str, text: str) -> None:
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")

    def stage_deletion(self, relative: str) -> None:
        self.git("rm", "-q", relative)

    def hook(self) -> subprocess.CompletedProcess:
        return subprocess.run(
            ["python3", str(PRE_COMMIT)],
            cwd=self.root,
            env=GIT_FREE_ENV,
            capture_output=True,
            text=True,
        )


class PreCommitStagedTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.repo = PreCommitRepo(Path(self._tmp.name))

    def assertPassedStagedCheck(self, result: subprocess.CompletedProcess) -> None:
        """staged 해석 단계를 지났는지만 본다.

        임시 저장소에는 package.json이 없어 어차피 npm 단계에서 막힌다. 그러니
        "비어 있다"고 막히지 않았다는 사실이 곧 해석이 맞았다는 뜻이다.
        """
        self.assertNotIn(EMPTY, result.stderr, result.stdout + result.stderr)

    def test_deletion_only_commit_passes_staged_check(self):
        """한 번 뚫렸던 구멍. 삭제만 담은 commit이 "변경 없음"으로 막혔다."""
        self.repo.stage_deletion("seed.txt")
        self.assertPassedStagedCheck(self.repo.hook())

    def test_nothing_staged_is_still_blocked(self):
        """삭제를 세기 시작했다고 진짜 빈 commit까지 통과하면 안 된다."""
        result = self.repo.hook()
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn(EMPTY, result.stderr)

    def test_unstaged_deletion_does_not_count(self):
        """working tree에서만 지운 것은 staged가 아니다."""
        (self.repo.root / "seed.txt").unlink()
        result = self.repo.hook()
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn(EMPTY, result.stderr)

    def test_harness_deletion_triggers_harness_self_test(self):
        """하네스 파일을 지우는 것도 신뢰 경계를 바꾸는 일이다.

        자체 테스트 목록이 `staged`(ACMR)만 보면 삭제 commit은 검증 없이 지나간다.
        임시 저장소에는 harness/tests가 없으므로, 자체 테스트가 실행됐다면 그
        단계 이름으로 실패한다.

        앞선 npm 단계에서 먼저 멈추면 아무것도 확인하지 못하므로, 여기서만
        통과하는 no-op script를 깔아 자체 테스트 단계까지 도달시킨다.
        """
        self.repo.write(
            "package.json",
            '{"name":"fixture","scripts":'
            '{"typecheck":"true","test":"true","build":"true"}}\n',
        )
        self.repo.write("harness/policy.py", "# fixture\n")
        self.repo.git("add", "-A")
        self.repo.git("commit", "-q", "-m", "harness fixture")
        self.repo.stage_deletion("harness/policy.py")

        result = self.repo.hook()
        self.assertPassedStagedCheck(result)
        self.assertIn("harness 자체 테스트", result.stderr, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
