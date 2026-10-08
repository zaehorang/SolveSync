"""ci_gate의 회귀 테스트.

`policy.py`는 순수 함수라 값만 넣으면 되지만 `ci_gate.py`는 git이 내주는 형식을
직접 해석한다. combined diff의 marker 폭, NUL로 나뉜 경로, 루트 커밋, 커밋 순회가
모두 여기 있다. 이 해석이 조용히 어긋나면 gate는 통과만 하고 아무것도 막지 않는다.

그래서 임시 저장소를 실제로 만들어서 돌린다. 각 테스트는 한 번 뚫렸던 구멍 하나에
대응한다.
"""

from __future__ import annotations

import os
import subprocess
import tempfile
import unittest
from pathlib import Path

CI_GATE = Path(__file__).resolve().parent.parent / "ci_gate.py"

# git은 hook을 실행할 때 `GIT_DIR`과 `GIT_INDEX_FILE`을 환경에 내보낸다. 그 환경을
# 물려받은 자식 프로세스에서는 `cwd`가 무시되고 실제 저장소가 조작된다. pre-commit이
# 이 테스트를 돌리므로 여기서 걷어내지 않으면 커밋할 때마다 저장소가 오염된다.
GIT_FREE_ENV = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}

# 진짜 token이 아니다. `policy.SECRET_PATTERNS`의 GitHub PAT 형태만 흉내 낸다.
FAKE_PAT = "ghp_" + "A" * 24


class CiGateRepo:
    """임시 git 저장소. `base` branch를 기준점으로 둔다."""

    def __init__(self, root: Path) -> None:
        self.root = root
        self.git("init", "-q", "-b", "main")
        self.git("config", "user.email", "harness@example.com")
        self.git("config", "user.name", "harness")
        self.write("seed.txt", "seed\n")
        self.commit("base")
        self.git("branch", "base")
        self._assert_isolated()

    def _assert_isolated(self) -> None:
        """이 저장소가 정말 임시 디렉터리인지 확인한다.

        환경이 새면 아래 테스트들이 실제 저장소에 커밋하고 branch를 만든다. 그때
        테스트는 통과하므로 조용히 오염된다. 그러니 시작할 때 한 번 확인한다.
        """
        top = self.git("rev-parse", "--show-toplevel").strip()
        if not top or Path(top).resolve() != self.root.resolve():
            raise AssertionError(
                f"테스트 저장소가 격리되지 않았습니다. toplevel={top!r} root={self.root!r}. "
                "git이 내보낸 GIT_* 환경변수가 새는지 확인하세요."
            )

    def git(self, *args: str) -> str:
        result = subprocess.run(
            ["git", *args],
            cwd=self.root,
            env=GIT_FREE_ENV,
            capture_output=True,
            text=True,
        )
        return result.stdout

    def write(self, relative: str, text: str) -> None:
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")

    def commit(self, message: str) -> None:
        self.git("add", "-f", "-A")
        self.git("commit", "-q", "-m", message)

    def gate(self, base: str = "base") -> subprocess.CompletedProcess:
        return subprocess.run(
            ["python3", str(CI_GATE), base],
            cwd=self.root,
            env=GIT_FREE_ENV,
            capture_output=True,
            text=True,
        )


class CiGateTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.repo = CiGateRepo(Path(self._tmp.name))

    def assertBlocked(self, result: subprocess.CompletedProcess, fragment: str) -> None:
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn(fragment, result.stderr)

    def assertAllowed(self, result: subprocess.CompletedProcess) -> None:
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    # --- 통과해야 하는 것 ---------------------------------------------------

    def test_ordinary_changes_pass(self):
        self.repo.write("docs/note.md", "본문\n")
        self.repo.commit("docs: note")
        self.assertAllowed(self.repo.gate())

    def test_removing_a_secret_that_base_already_had_passes(self):
        """정리하는 쪽을 막는 gate는 사람을 잘못된 방향으로 보낸다."""
        self.repo.write("old.py", f'token = "{FAKE_PAT}"\n')
        self.repo.commit("seed secret")
        self.repo.git("branch", "seeded")
        (self.repo.root / "old.py").unlink()
        self.repo.commit("remove secret")
        self.assertAllowed(self.repo.gate("seeded"))

    def test_no_new_commits_pass(self):
        self.assertAllowed(self.repo.gate("HEAD"))

    def test_commits_only_on_the_base_side_are_not_this_range(self):
        """base가 앞서 나갔을 때 그쪽 커밋까지 보면 남의 커밋으로 이 PR을 막는다.

        `base..HEAD`와 `base...HEAD`는 base가 조상일 때만 같다. 갈라지면 달라진다.
        """
        self.repo.git("checkout", "-q", "-b", "work", "base")
        self.repo.write("mine.txt", "ok\n")
        self.repo.commit("work")
        self.repo.git("checkout", "-q", "base")
        self.repo.write("theirs.py", f'token = "{FAKE_PAT}"\n')
        self.repo.commit("base moved ahead with a secret")
        self.repo.git("checkout", "-q", "work")
        self.assertAllowed(self.repo.gate("base"))

    # --- 범위 -------------------------------------------------------------

    def test_unresolvable_base_is_fail_closed(self):
        """검사 범위를 모르는 gate가 범위를 안전하다고 가정해서는 안 된다."""
        result = self.repo.gate("0" * 40)
        self.assertBlocked(result, "찾을 수 없습니다")

    def test_secret_added_then_removed_in_range_is_blocked(self):
        """net diff로 보면 사라진다. 값은 이미 push된 history에 남아 있다."""
        self.repo.write("leak.py", f'token = "{FAKE_PAT}"\n')
        self.repo.commit("add leak")
        (self.repo.root / "leak.py").unlink()
        self.repo.commit("remove leak")
        self.assertBlocked(self.repo.gate(), "secret으로 보이는 값")

    def test_artifact_in_an_earlier_commit_of_the_range_is_blocked(self):
        """마지막 커밋만 보면 한 번에 올라간 앞 커밋을 놓친다."""
        self.repo.write("dist/bundle.js", "artifact\n")
        self.repo.commit("artifact")
        self.repo.write("later.txt", "innocent\n")
        self.repo.commit("later")
        self.assertBlocked(self.repo.gate(), "dist/bundle.js")

    def test_root_commit_is_inspected(self):
        """`--root` 없이는 루트 커밋이 경로도 patch도 내지 않는다."""
        self.repo.git("checkout", "-q", "--orphan", "orphan")
        self.repo.git("rm", "-rq", "--cached", ".")
        (self.repo.root / "seed.txt").unlink()
        self.repo.write("dist/bundle.js", "artifact\n")
        self.repo.commit("orphan root")
        self.assertBlocked(self.repo.gate(), "dist/bundle.js")

    # --- patch 해석 -------------------------------------------------------

    def test_added_line_starting_with_a_plus_is_scanned(self):
        """`++counter;`는 diff에서 `+++`로 시작해 파일 header처럼 보인다."""
        self.repo.write("p.js", f"x\n++attempt; // {FAKE_PAT}\n")
        self.repo.commit("plus prefixed line")
        self.assertBlocked(self.repo.gate(), "secret으로 보이는 값")

    def test_merge_resolution_secret_is_blocked(self):
        """merge 커밋은 `-c` 없이는 patch를 내지 않는다."""
        self._prepare_conflict()
        self.repo.write("f.txt", f'a\ntoken = "{FAKE_PAT}"\nc\n')
        self.repo.commit("merge")
        self.assertBlocked(self.repo.gate(), "secret으로 보이는 값")

    def test_merge_resolution_artifact_is_blocked(self):
        self._prepare_conflict()
        self.repo.write("f.txt", "a\nRESOLVED\nc\n")
        self.repo.write("dist/bundle.js", "artifact\n")
        self.repo.commit("merge")
        self.assertBlocked(self.repo.gate(), "dist/bundle.js")

    # --- 경로 -------------------------------------------------------------

    def test_secret_in_a_file_name_is_blocked(self):
        """내용 scan에도 금지 경로 검사에도 걸리지 않던 자리다."""
        self.repo.write(f"{FAKE_PAT}.txt", "harmless\n")
        self.repo.commit("token as a file name")
        self.assertBlocked(self.repo.gate(), "secret으로 보이는 값")

    def test_quoted_non_ascii_forbidden_path_is_blocked(self):
        """quotePath 기본값에서 한글 경로는 C-style로 quote되어 돌아온다."""
        self.repo.write("dist/한글.js", "artifact\n")
        self.repo.commit("korean artifact")
        self.assertBlocked(self.repo.gate(), "한글.js")

    def test_non_ascii_ordinary_path_passes(self):
        self.repo.write("docs/문서.md", "본문\n")
        self.repo.commit("korean doc")
        self.assertAllowed(self.repo.gate())

    # --- helper -----------------------------------------------------------

    def _prepare_conflict(self) -> None:
        """같은 줄을 서로 다르게 고친 두 branch를 만들고 merge를 멈춰 세운다."""
        self.repo.write("f.txt", "a\nb\nc\n")
        self.repo.commit("seed conflict base")
        self.repo.git("branch", "base", "-f")
        self.repo.git("checkout", "-q", "-b", "side")
        self.repo.write("f.txt", "a\nSIDE\nc\n")
        self.repo.commit("side")
        self.repo.git("checkout", "-q", "main")
        self.repo.write("f.txt", "a\nMAIN\nc\n")
        self.repo.commit("main")
        self.repo.git("merge", "-q", "side")


if __name__ == "__main__":
    unittest.main()
