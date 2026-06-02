from __future__ import annotations

import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.harness.errors import GitOperationError
from scripts.harness.git_ops import GitOps


def _git_result(args: tuple[str, ...], returncode: int = 0, stdout: str = "", stderr: str = ""):
    return subprocess.CompletedProcess(["git", *args], returncode, stdout, stderr)


class GitOpsTests(unittest.TestCase):
    def _ops(self, root: Path | None = None) -> GitOps:
        return GitOps(
            root_path=root or Path("/repo"),
            phase_name="4-harness-runner-refactor",
            phase_dir_name="4-harness-runner-refactor",
        )

    def test_ensure_clean_worktree_raises_with_dirty_file_list(self):
        ops = self._ops()

        with patch.object(
            ops,
            "_run_git",
            return_value=_git_result(("status", "--porcelain"), stdout=" M scripts/execute.py\n?? new.py\n"),
        ):
            with self.assertRaisesRegex(GitOperationError, "scripts/execute.py"):
                ops.ensure_clean_worktree()

    def test_ensure_clean_worktree_allows_current_phase_metadata_modifications(self):
        ops = self._ops()
        allowed_paths = {
            "phases/index.json",
            "phases/4-harness-runner-refactor/index.json",
        }

        for status in (" M", "M ", "MM"):
            with self.subTest(status=status):
                with patch.object(
                    ops,
                    "_run_git",
                    return_value=_git_result(
                        ("status", "--porcelain"),
                        stdout=(
                            f"{status} phases/index.json\n"
                            f"{status} phases/4-harness-runner-refactor/index.json\n"
                        ),
                    ),
                ):
                    ops.ensure_clean_worktree(allowed_dirty_paths=allowed_paths)

    def test_ensure_clean_worktree_blocks_mixed_or_untracked_recovery_metadata(self):
        ops = self._ops()
        allowed_paths = {
            "phases/index.json",
            "phases/4-harness-runner-refactor/index.json",
        }

        cases = {
            "mixed_code_change": " M phases/index.json\n M scripts/harness/runner.py\n",
            "other_phase_metadata": " M phases/other-phase/index.json\n",
            "untracked_metadata": "?? phases/index.json\n",
            "deleted_metadata": " D phases/4-harness-runner-refactor/index.json\n",
            "renamed_metadata": "R  phases/old/index.json -> phases/4-harness-runner-refactor/index.json\n",
        }

        for name, stdout in cases.items():
            with self.subTest(name=name):
                with patch.object(
                    ops,
                    "_run_git",
                    return_value=_git_result(("status", "--porcelain"), stdout=stdout),
                ):
                    with self.assertRaises(GitOperationError):
                        ops.ensure_clean_worktree(allowed_dirty_paths=allowed_paths)

    def test_checkout_branch_is_noop_when_current_branch_is_target(self):
        ops = self._ops()
        calls: list[tuple[str, ...]] = []

        def run_git(*args: str):
            calls.append(args)
            if args == ("rev-parse", "--git-dir"):
                return _git_result(args, stdout=".git\n")
            if args == ("symbolic-ref", "--quiet", "--short", "HEAD"):
                return _git_result(args, stdout="feat-4-harness-runner-refactor\n")
            return _git_result(args)

        with patch.object(ops, "_run_git", side_effect=run_git):
            ops.checkout_branch()

        self.assertNotIn(("checkout", "feat-4-harness-runner-refactor"), calls)
        self.assertNotIn(("checkout", "-b", "feat-4-harness-runner-refactor"), calls)

    def test_checkout_branch_uses_existing_target_branch(self):
        ops = self._ops()
        calls: list[tuple[str, ...]] = []

        def run_git(*args: str):
            calls.append(args)
            if args == ("rev-parse", "--git-dir"):
                return _git_result(args)
            if args == ("symbolic-ref", "--quiet", "--short", "HEAD"):
                return _git_result(args, stdout="main\n")
            if args == ("rev-parse", "--verify", "feat-4-harness-runner-refactor"):
                return _git_result(args)
            return _git_result(args)

        with patch.object(ops, "_run_git", side_effect=run_git):
            ops.checkout_branch()

        self.assertIn(("checkout", "feat-4-harness-runner-refactor"), calls)

    def test_checkout_branch_creates_missing_target_branch(self):
        ops = self._ops()
        calls: list[tuple[str, ...]] = []

        def run_git(*args: str):
            calls.append(args)
            if args == ("rev-parse", "--git-dir"):
                return _git_result(args)
            if args == ("symbolic-ref", "--quiet", "--short", "HEAD"):
                return _git_result(args, stdout="main\n")
            if args == ("rev-parse", "--verify", "feat-4-harness-runner-refactor"):
                return _git_result(args, returncode=1, stderr="not found")
            return _git_result(args)

        with patch.object(ops, "_run_git", side_effect=run_git):
            ops.checkout_branch()

        self.assertIn(("checkout", "-b", "feat-4-harness-runner-refactor"), calls)

    def test_commit_step_runs_quality_gate_only_before_feature_commit_and_excludes_metadata(self):
        ops = self._ops()
        calls: list[tuple[str, ...]] = []
        events: list[str] = []
        diff_calls = 0

        def run_git(*args: str):
            nonlocal diff_calls
            calls.append(args)
            if args == ("rev-parse", "--verify", "HEAD"):
                return _git_result(args)
            if args == ("diff", "--cached", "--quiet"):
                diff_calls += 1
                return _git_result(args, returncode=1 if diff_calls == 1 else 0)
            if args[0] == "commit":
                events.append(args[-1])
            return _git_result(args)

        with (
            patch.object(ops, "_run_git", side_effect=run_git),
            patch.object(ops, "run_quality_gate", side_effect=lambda: events.append("quality")),
        ):
            ops.commit_step(3, "git-ops-quality-gate")

        self.assertIn(
            (
                "reset",
                "HEAD",
                "--",
                "phases/index.json",
                "phases/4-harness-runner-refactor/index.json",
            ),
            calls,
        )
        self.assertEqual(
            events,
            ["quality", "feat(4-harness-runner-refactor): step 3 — git-ops-quality-gate"],
        )

    def test_commit_step_runs_harness_self_test_for_harness_related_feature_changes(self):
        ops = self._ops()
        events: list[str] = []
        diff_calls = 0

        def run_git(*args: str):
            nonlocal diff_calls
            if args == ("rev-parse", "--verify", "HEAD"):
                return _git_result(args)
            if args == ("diff", "--cached", "--quiet"):
                diff_calls += 1
                return _git_result(args, returncode=1 if diff_calls == 1 else 0)
            if args == ("diff", "--cached", "--name-only"):
                return _git_result(args, stdout="scripts/harness/git_ops.py\n")
            if args[0] == "commit":
                events.append(args[-1])
            return _git_result(args)

        with (
            patch.object(ops, "_run_git", side_effect=run_git),
            patch.object(ops, "run_quality_gate", side_effect=lambda: events.append("quality")),
            patch.object(ops, "run_harness_self_test", side_effect=lambda: events.append("self-test")),
        ):
            ops.commit_step(3, "git-ops-quality-gate")

        self.assertEqual(
            events,
            [
                "quality",
                "self-test",
                "feat(4-harness-runner-refactor): step 3 — git-ops-quality-gate",
            ],
        )

    def test_commit_step_skips_harness_self_test_for_product_only_feature_changes(self):
        ops = self._ops()
        diff_calls = 0

        def run_git(*args: str):
            nonlocal diff_calls
            if args == ("rev-parse", "--verify", "HEAD"):
                return _git_result(args)
            if args == ("diff", "--cached", "--quiet"):
                diff_calls += 1
                return _git_result(args, returncode=1 if diff_calls == 1 else 0)
            if args == ("diff", "--cached", "--name-only"):
                return _git_result(args, stdout="src/shared/index.ts\n")
            return _git_result(args)

        with (
            patch.object(ops, "_run_git", side_effect=run_git),
            patch.object(ops, "run_quality_gate"),
            patch.object(ops, "run_harness_self_test") as self_test,
        ):
            ops.commit_step(3, "product-change")

        self_test.assert_not_called()

    def test_commit_step_skips_quality_gate_for_metadata_only_commit(self):
        ops = self._ops()
        calls: list[tuple[str, ...]] = []
        diff_calls = 0

        def run_git(*args: str):
            nonlocal diff_calls
            calls.append(args)
            if args == ("rev-parse", "--verify", "HEAD"):
                return _git_result(args)
            if args == ("diff", "--cached", "--quiet"):
                diff_calls += 1
                return _git_result(args, returncode=0 if diff_calls == 1 else 1)
            return _git_result(args)

        with (
            patch.object(ops, "_run_git", side_effect=run_git),
            patch.object(ops, "run_quality_gate") as quality_gate,
            patch.object(ops, "run_harness_self_test") as self_test,
        ):
            ops.commit_step(3, "metadata-only")

        quality_gate.assert_not_called()
        self_test.assert_not_called()
        self.assertIn(
            ("commit", "-m", "chore(4-harness-runner-refactor): step 3 metadata"),
            calls,
        )

    def test_commit_step_hard_fails_when_quality_gate_fails(self):
        ops = self._ops()
        calls: list[tuple[str, ...]] = []

        def run_git(*args: str):
            calls.append(args)
            if args == ("rev-parse", "--verify", "HEAD"):
                return _git_result(args)
            if args == ("diff", "--cached", "--quiet"):
                return _git_result(args, returncode=1)
            return _git_result(args)

        with (
            patch.object(ops, "_run_git", side_effect=run_git),
            patch.object(ops, "run_quality_gate", side_effect=GitOperationError("gate failed")),
        ):
            with self.assertRaisesRegex(GitOperationError, "gate failed"):
                ops.commit_step(3, "feature")

        self.assertNotIn(("commit", "-m", "feat(4-harness-runner-refactor): step 3 — feature"), calls)

    def test_commit_step_hard_fails_when_metadata_commit_fails(self):
        ops = self._ops()
        diff_calls = 0

        def run_git(*args: str):
            nonlocal diff_calls
            if args == ("rev-parse", "--verify", "HEAD"):
                return _git_result(args)
            if args == ("diff", "--cached", "--quiet"):
                diff_calls += 1
                return _git_result(args, returncode=0 if diff_calls == 1 else 1)
            if args == ("commit", "-m", "chore(4-harness-runner-refactor): step 3 metadata"):
                return _git_result(args, returncode=1, stderr="commit failed")
            return _git_result(args)

        with patch.object(ops, "_run_git", side_effect=run_git):
            with self.assertRaisesRegex(GitOperationError, "metadata commit failed"):
                ops.commit_step(3, "metadata-only")

    def test_commit_phase_completed_commits_metadata_without_quality_gate(self):
        ops = self._ops()
        calls: list[tuple[str, ...]] = []

        def run_git(*args: str):
            calls.append(args)
            if args == ("diff", "--cached", "--quiet"):
                return _git_result(args, returncode=1)
            return _git_result(args)

        with (
            patch.object(ops, "_run_git", side_effect=run_git),
            patch.object(ops, "run_quality_gate") as quality_gate,
        ):
            ops.commit_phase_completed()

        quality_gate.assert_not_called()
        self.assertIn(
            ("commit", "-m", "chore(4-harness-runner-refactor): mark phase completed"),
            calls,
        )

    def test_push_phase_branch_hard_fails_on_push_error(self):
        ops = self._ops()

        with patch.object(
            ops,
            "_run_git",
            return_value=_git_result(
                ("push", "-u", "origin", "feat-4-harness-runner-refactor"),
                returncode=1,
                stderr="rejected",
            ),
        ):
            with self.assertRaisesRegex(GitOperationError, "rejected"):
                ops.push_phase_branch()

    def test_run_quality_gate_raises_with_stdout_and_stderr_on_failure(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            gate = root / "scripts" / "quality_gate.py"
            gate.parent.mkdir()
            gate.write_text("#!/usr/bin/env python3\n", encoding="utf-8")
            ops = self._ops(root)

            with patch(
                "scripts.harness.git_ops.subprocess.run",
                return_value=subprocess.CompletedProcess(["python"], 1, "stdout text", "stderr text"),
            ):
                with self.assertRaisesRegex(GitOperationError, "stdout text"):
                    ops.run_quality_gate()


if __name__ == "__main__":
    unittest.main()
