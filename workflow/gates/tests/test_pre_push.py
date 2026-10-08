"""pre-push hook의 ref 범위와 검증 순서 회귀 테스트."""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

PRE_PUSH = Path(__file__).resolve().parent.parent / "hooks" / "pre-push"
GIT_FREE_ENV = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
ZERO_SHA = "0" * 64
LEGACY_ZERO_SHA = "0" * 40


class PrePushRepo:
    def __init__(self, tmp: Path) -> None:
        self.root = tmp / "repo"
        self.root.mkdir()
        self._git("init", "-q", "-b", "main")
        self._git("config", "user.email", "harness@example.com")
        self._git("config", "user.name", "harness")
        self.write("seed.txt", "seed\n")
        self.commit("base")
        self.base = self.git("rev-parse", "HEAD").strip()
        self._git("update-ref", "refs/remotes/origin/main", self.base)
        self._git("switch", "-q", "-c", "chore/fixture")
        self.log = self.root / "commands.log"
        self.bin = self.root / "bin"
        self.bin.mkdir()
        fake = (
            f"#!{sys.executable}\n"
            "import os, sys\n"
            "with open(os.environ['PRE_PUSH_LOG'], 'a', encoding='utf-8') as log:\n"
            "    log.write(' '.join(sys.argv[1:]) + '\\n')\n"
            "sys.exit(1 if os.environ.get('PRE_PUSH_FAIL') in sys.argv[1:] else 0)\n"
        )
        for name in ("npm", "python3"):
            command = self.bin / name
            command.write_text(fake, encoding="utf-8")
            command.chmod(0o755)

    def _git(self, *args: str) -> str:
        result = subprocess.run(
            ["git", *args], cwd=self.root, env=GIT_FREE_ENV, capture_output=True, text=True
        )
        if result.returncode:
            raise AssertionError(result.stderr)
        return result.stdout

    def git(self, *args: str) -> str:
        return self._git(*args)

    def write(self, relative: str, text: str) -> None:
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")

    def commit(self, message: str) -> str:
        self.git("add", "-A")
        self.git("commit", "-q", "-m", message)
        return self.git("rev-parse", "HEAD").strip()

    def push(
        self,
        remote_sha: str | None = None,
        *,
        local_sha: str | None = None,
        failure: str | None = None,
        local_ref: str = "refs/heads/chore/fixture",
        remote_ref: str = "refs/heads/chore/fixture",
    ) -> subprocess.CompletedProcess[str]:
        local_sha = local_sha or self.git("rev-parse", "HEAD").strip()
        remote_sha = remote_sha if remote_sha is not None else self.base
        env = {
            **GIT_FREE_ENV,
            "PRE_PUSH_LOG": str(self.log),
            "PATH": f"{self.bin}{os.pathsep}{GIT_FREE_ENV['PATH']}",
        }
        if failure:
            env["PRE_PUSH_FAIL"] = failure
        return subprocess.run(
            [sys.executable, str(PRE_PUSH)],
            cwd=self.root,
            env=env,
            input=f"{local_ref} {local_sha} {remote_ref} {remote_sha}\n",
            capture_output=True,
            text=True,
        )

    def commands(self) -> list[str]:
        if not self.log.exists():
            return []
        return self.log.read_text(encoding="utf-8").splitlines()


class PrePushTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.repo = PrePushRepo(Path(self._tmp.name))

    def test_failed_check_blocks_push(self):
        self.repo.write("solution.txt", "change\n")
        self.repo.commit("change")
        result = self.repo.push(failure="test")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("test 실패", result.stderr)
        self.assertEqual(self.repo.commands(), ["run typecheck", "test"])

    def test_success_runs_project_checks(self):
        self.repo.write("solution.txt", "change\n")
        self.repo.commit("change")
        result = self.repo.push()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.repo.commands(), ["run typecheck", "test", "run build"])

    def test_branch_deletion_does_not_run_checks(self):
        result = self.repo.push(local_sha=LEGACY_ZERO_SHA)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.repo.commands(), [])

    def test_non_40_character_branch_deletion_does_not_run_checks(self):
        result = self.repo.push(local_sha=ZERO_SHA)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.repo.commands(), [])

    def test_tracked_uncommitted_change_blocks_push(self):
        self.repo.write("seed.txt", "dirty\n")
        result = self.repo.push()
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("미커밋 변경", result.stderr)
        self.assertEqual(self.repo.commands(), [])

    def test_harness_change_runs_harness_tests(self):
        self.repo.write("workflow/gates/policy.py", "# changed\n")
        self.repo.commit("harness change")
        result = self.repo.push()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(
            self.repo.commands(),
            ["run typecheck", "test", "run build", "-m unittest discover -s workflow/gates/tests -t workflow/gates"],
        )

    def test_new_branch_uses_origin_main_merge_base(self):
        self.repo.write("workflow/gates/policy.py", "# changed\n")
        self.repo.commit("harness change")
        result = self.repo.push(remote_sha=ZERO_SHA)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("-m unittest", self.repo.commands()[-1])

    def test_missing_origin_main_runs_harness_tests(self):
        self.repo.write("solution.txt", "change\n")
        self.repo.commit("change")
        self.repo.git("update-ref", "-d", "refs/remotes/origin/main")
        result = self.repo.push(remote_sha=ZERO_SHA)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("-m unittest", self.repo.commands()[-1])

    def test_missing_remote_sha_runs_harness_tests(self):
        self.repo.write("solution.txt", "change\n")
        self.repo.commit("change")
        result = self.repo.push(remote_sha="f" * 40)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("-m unittest", self.repo.commands()[-1])

    def test_non_head_ref_is_blocked_before_checks(self):
        self.repo.write("solution.txt", "first\n")
        old_sha = self.repo.commit("first")
        self.repo.write("solution.txt", "second\n")
        self.repo.commit("second")
        result = self.repo.push(local_sha=old_sha)
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("체크아웃", result.stderr)
        self.assertEqual(self.repo.commands(), [])

    def test_tag_at_non_head_is_blocked_before_checks(self):
        self.repo.write("solution.txt", "first\n")
        old_sha = self.repo.commit("first")
        self.repo.write("solution.txt", "second\n")
        self.repo.commit("second")
        result = self.repo.push(local_sha=old_sha, local_ref="refs/tags/v1", remote_ref="refs/tags/v1")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertEqual(self.repo.commands(), [])

    def test_annotated_tag_at_head_runs_checks(self):
        self.repo.write("solution.txt", "change\n")
        self.repo.commit("change")
        self.repo.git("tag", "-a", "v1", "-m", "v1")
        tag_sha = self.repo.git("rev-parse", "v1").strip()
        result = self.repo.push(local_sha=tag_sha, local_ref="refs/tags/v1", remote_ref="refs/tags/v1")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.repo.commands(), ["run typecheck", "test", "run build"])

    def test_multiple_refs_at_head_run_checks_once(self):
        self.repo.write("solution.txt", "change\n")
        self.repo.commit("change")
        local_sha = self.repo.git("rev-parse", "HEAD").strip()
        env = {
            **GIT_FREE_ENV,
            "PRE_PUSH_LOG": str(self.repo.log),
            "PATH": f"{self.repo.bin}{os.pathsep}{GIT_FREE_ENV['PATH']}",
        }
        result = subprocess.run(
            [sys.executable, str(PRE_PUSH)],
            cwd=self.repo.root,
            env=env,
            input=(
                f"refs/heads/chore/fixture {local_sha} refs/heads/chore/fixture {self.repo.base}\n"
                f"refs/tags/v1 {local_sha} refs/tags/v1 {ZERO_SHA}\n"
            ),
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.repo.commands(), ["run typecheck", "test", "run build"])


if __name__ == "__main__":
    unittest.main()
