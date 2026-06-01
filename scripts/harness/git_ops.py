"""Git operations for the Codex harness runner."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from scripts.harness.errors import GitOperationError


class GitOps:
    """Owns git branch, commit, push, and quality gate behavior for a phase."""

    FEAT_MSG = "feat({phase}): step {num} — {name}"
    CHORE_MSG = "chore({phase}): step {num} metadata"
    FINAL_MSG = "chore({phase}): mark phase completed"

    def __init__(self, *, root_path: Path, phase_name: str, phase_dir_name: str):
        self._root_path = Path(root_path)
        self._phase_name = phase_name
        self._phase_dir_name = phase_dir_name

    @property
    def target_branch(self) -> str:
        return f"feat-{self._phase_name}"

    def ensure_clean_worktree(self) -> None:
        result = self._run_git("status", "--porcelain")
        self._raise_for_git_failure("check git status", result)

        dirty = [line for line in result.stdout.splitlines() if line.strip()]
        if dirty:
            files = "\n".join(dirty)
            raise GitOperationError(f"dirty worktree before harness run:\n{files}")

    def checkout_branch(self) -> None:
        result = self._run_git("rev-parse", "--git-dir")
        self._raise_for_git_failure("verify git repository", result)

        current = self._run_git("symbolic-ref", "--quiet", "--short", "HEAD")
        if current.returncode == 0 and current.stdout.strip() == self.target_branch:
            return

        exists = self._run_git("rev-parse", "--verify", self.target_branch)
        if exists.returncode == 0:
            result = self._run_git("checkout", self.target_branch)
        else:
            result = self._run_git("checkout", "-b", self.target_branch)

        self._raise_for_git_failure(f"checkout branch '{self.target_branch}'", result)
        print(f"  Branch: {self.target_branch}")

    def commit_step(self, step_num: int, step_name: str) -> None:
        self._stage_all_changes()
        self._unstage_paths(self._metadata_paths())

        if self._has_staged_changes():
            self.run_quality_gate()
            message = self.FEAT_MSG.format(
                phase=self._phase_name,
                num=step_num,
                name=step_name,
            )
            self._commit(message, "feature commit")
            print(f"  Commit: {message}")

        self._stage_metadata_changes()
        if self._has_staged_changes():
            message = self.CHORE_MSG.format(phase=self._phase_name, num=step_num)
            self._commit(message, "metadata commit")

    def commit_phase_completed(self) -> None:
        self._stage_metadata_changes()
        if not self._has_staged_changes():
            return

        message = self.FINAL_MSG.format(phase=self._phase_name)
        self._commit(message, "final metadata commit")
        print(f"  ✓ {message}")

    def push(self, auto_branch_name: str) -> None:
        result = self._run_git("push", "-u", "origin", auto_branch_name)
        self._raise_for_git_failure(f"push branch '{auto_branch_name}'", result)

    def push_phase_branch(self) -> None:
        self.push(self.target_branch)
        print(f"  ✓ Pushed to origin/{self.target_branch}")

    def run_quality_gate(self) -> None:
        gate = self._root_path / "scripts" / "quality_gate.py"
        if not gate.exists():
            return

        result = subprocess.run(
            [sys.executable, str(gate)],
            cwd=str(self._root_path),
            capture_output=True,
            text=True,
        )
        if result.returncode == 0:
            return

        details = ["quality gate failed before feature commit"]
        if result.stdout.strip():
            details.append(result.stdout.strip())
        if result.stderr.strip():
            details.append(result.stderr.strip())
        raise GitOperationError("\n".join(details))

    def _run_git(self, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["git", *args],
            cwd=str(self._root_path),
            capture_output=True,
            text=True,
        )

    def _stage_all_changes(self) -> None:
        result = self._run_git("add", "-A")
        self._raise_for_git_failure("stage worktree changes", result)

    def _stage_metadata_changes(self) -> None:
        result = self._run_git("add", "-A", "--", *self._metadata_paths())
        self._raise_for_git_failure("stage harness metadata changes", result)

    def _unstage_paths(self, paths: list[str]) -> None:
        if self._has_head():
            result = self._run_git("reset", "HEAD", "--", *paths)
        else:
            result = self._run_git("rm", "--cached", "--ignore-unmatch", "--", *paths)
        self._raise_for_git_failure("exclude harness metadata from feature commit", result)

    def _metadata_paths(self) -> list[str]:
        return [
            "phases/index.json",
            f"phases/{self._phase_dir_name}/index.json",
        ]

    def _has_head(self) -> bool:
        return self._run_git("rev-parse", "--verify", "HEAD").returncode == 0

    def _has_staged_changes(self) -> bool:
        result = self._run_git("diff", "--cached", "--quiet")
        if result.returncode == 0:
            return False
        if result.returncode == 1:
            return True
        self._raise_for_git_failure("check staged changes", result)
        return False

    def _commit(self, message: str, action: str) -> None:
        result = self._run_git("commit", "-m", message)
        self._raise_for_git_failure(action, result)

    @staticmethod
    def _raise_for_git_failure(action: str, result: subprocess.CompletedProcess[str]) -> None:
        if result.returncode == 0:
            return

        output = result.stderr.strip() or result.stdout.strip() or f"exit code {result.returncode}"
        raise GitOperationError(f"{action} failed: {output}")
