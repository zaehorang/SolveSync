from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from scripts.harness.codex_client import CodexClient, CodexRunResult
from scripts.harness.errors import BlockedStep, FailedStep, PhaseValidationError
from scripts.harness.phase_index import StepConfig, read_json, write_json
from scripts.harness.runner import HarnessConfig, HarnessRunner


class HarnessRunnerTests(unittest.TestCase):
    def test_runner_interfaces_are_exported_from_package(self):
        import scripts.harness as harness

        self.assertIs(harness.HarnessConfig, HarnessConfig)
        self.assertIs(harness.HarnessRunner, HarnessRunner)

    def test_phase_index_helpers_are_exported_from_package(self):
        import scripts.harness as harness
        from scripts.harness import phase_index

        self.assertIs(harness.StepStatus, phase_index.StepStatus)
        self.assertIs(harness.update_step, phase_index.update_step)
        self.assertIs(harness.clear_step_fields, phase_index.clear_step_fields)

    def test_build_prompt_includes_guardrails_context_retry_details_and_step_body(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._write_phase(
                root,
                [
                    {
                        "step": 0,
                        "name": "setup",
                        "status": "completed",
                        "summary": "created base files",
                    },
                    {
                        "step": 1,
                        "name": "api",
                        "status": "pending",
                        "max_attempts": 5,
                        "timeout_sec": 60,
                    },
                ],
            )
            runner = HarnessRunner(HarnessConfig(root, "0-demo", False))

            prompt = runner._build_prompt(
                StepConfig(1, "api", "pending", 5, 60),
                "guardrails",
                "previous failure detail",
            )

        self.assertIn("guardrails", prompt)
        self.assertIn("- Step 0 (setup): created base files", prompt)
        self.assertIn("previous failure detail", prompt)
        self.assertIn("5회 수정 시도 후에도 실패", prompt)
        self.assertIn("git commit을 실행하지 마라", prompt)
        self.assertIn("# Step 1: api", prompt)

    def test_run_validates_phase_before_dirty_preflight(self):
        from scripts.harness import runner as runner_module

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._write_phase(root, [{"step": 0, "name": "setup", "status": "pending"}])
            (root / "phases" / "0-demo" / "step0.md").unlink()

            with patch.object(runner_module, "GitOps") as git_ops:
                with self.assertRaisesRegex(PhaseValidationError, "step0.md"):
                    HarnessRunner(HarnessConfig(root, "0-demo", False)).run()

            git_ops.assert_not_called()

    def test_run_performs_dirty_preflight_before_completed_short_circuit(self):
        from scripts.harness import runner as runner_module

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._write_phase(
                root,
                [
                    {
                        "step": 0,
                        "name": "setup",
                        "status": "completed",
                        "summary": "done",
                    }
                ],
                top_status="completed",
            )

            with (
                patch.object(runner_module, "GitOps") as git_ops,
                patch.object(runner_module, "CodexClient"),
            ):
                HarnessRunner(HarnessConfig(root, "0-demo", False)).run()

            git_ops.return_value.ensure_clean_worktree.assert_called_once_with(
                allowed_dirty_paths=["phases/index.json", "phases/0-demo/index.json"],
            )
            git_ops.return_value.checkout_branch.assert_not_called()

    def test_run_stops_existing_blocked_step_after_dirty_preflight_before_checkout(self):
        from scripts.harness import runner as runner_module

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._write_phase(
                root,
                [
                    {
                        "step": 0,
                        "name": "setup",
                        "status": "blocked",
                        "blocked_reason": "needs token",
                    }
                ],
            )

            with (
                patch.object(runner_module, "GitOps") as git_ops,
                patch.object(runner_module, "CodexClient"),
            ):
                with self.assertRaisesRegex(BlockedStep, "needs token"):
                    HarnessRunner(HarnessConfig(root, "0-demo", False)).run()

            git_ops.return_value.ensure_clean_worktree.assert_called_once_with(
                allowed_dirty_paths=["phases/index.json", "phases/0-demo/index.json"],
            )
            git_ops.return_value.checkout_branch.assert_not_called()

    def test_execute_all_steps_finalizes_completed_step_without_rerunning_agent(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._write_phase(
                root,
                [
                    {
                        "step": 0,
                        "name": "setup",
                        "status": "completed",
                        "summary": "done",
                    }
                ],
            )
            phase_dir = root / "phases" / "0-demo"
            live_log = phase_dir / "step0-live.log"
            live_log.write_text("log", encoding="utf-8")
            runner = self._direct_runner(root)

            runner._execute_all_steps("guardrails")

            updated = read_json(phase_dir / "index.json")
            self.assertIn("completed_at", updated["steps"][0])
            runner._git_ops.commit_step.assert_called_once_with(0, "setup")
            self.assertFalse(live_log.exists())

    def test_completed_step_deletes_live_log_after_commit(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._write_phase(root, [{"step": 0, "name": "setup", "status": "pending"}])
            phase_dir = root / "phases" / "0-demo"
            index_file = phase_dir / "index.json"
            live_log = phase_dir / "step0-live.log"
            live_log.write_text("log", encoding="utf-8")
            runner = self._direct_runner(root)

            def complete_step(_step: StepConfig, _prompt: str, _attempt: int) -> CodexRunResult:
                index = read_json(index_file)
                index["steps"][0]["status"] = "completed"
                index["steps"][0]["summary"] = "done"
                write_json(index_file, index)
                return CodexRunResult(
                    exit_code=0,
                    live_log_path="phases/0-demo/step0-live.log",
                    last_message="done",
                    elapsed_sec=4,
                )

            runner._codex.invoke = Mock(side_effect=complete_step)
            runner._execute_single_step(StepConfig(0, "setup", "pending", 3, 1800), "guardrails")

            self.assertFalse(live_log.exists())
            runner._git_ops.commit_step.assert_called_once_with(0, "setup")

    def test_failed_step_preserves_live_log_and_marks_top_index_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._write_phase(root, [{"step": 0, "name": "setup", "status": "pending"}])
            phase_dir = root / "phases" / "0-demo"
            live_log = phase_dir / "step0-live.log"
            live_log.write_text("log", encoding="utf-8")
            runner = self._direct_runner(root)
            runner._codex.invoke = Mock(
                return_value=CodexRunResult(
                    exit_code=1,
                    live_log_path="phases/0-demo/step0-live.log",
                    last_message="working",
                    commands=["npm test"],
                    stderr_tail=["boom"],
                )
            )

            with self.assertRaisesRegex(FailedStep, "failed after 1 attempts"):
                runner._execute_single_step(StepConfig(0, "setup", "pending", 1, 1800), "guardrails")

            updated = read_json(phase_dir / "index.json")
            top = read_json(root / "phases" / "index.json")
            self.assertTrue(live_log.exists())
            self.assertEqual(updated["steps"][0]["status"], "error")
            self.assertIn("Codex exit code: 1", updated["steps"][0]["error_message"])
            self.assertIn("stderr tail: boom", updated["steps"][0]["error_message"])
            self.assertEqual(top["phases"][0]["status"], "error")
            runner._git_ops.commit_step.assert_not_called()

    def test_blocked_step_preserves_live_log_and_marks_top_index_blocked(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._write_phase(root, [{"step": 0, "name": "setup", "status": "pending"}])
            phase_dir = root / "phases" / "0-demo"
            index_file = phase_dir / "index.json"
            live_log = phase_dir / "step0-live.log"
            live_log.write_text("log", encoding="utf-8")
            runner = self._direct_runner(root)

            def block_step(_step: StepConfig, _prompt: str, _attempt: int) -> CodexRunResult:
                index = read_json(index_file)
                index["steps"][0]["status"] = "blocked"
                index["steps"][0]["blocked_reason"] = "needs user"
                write_json(index_file, index)
                return CodexRunResult(
                    exit_code=0,
                    live_log_path="phases/0-demo/step0-live.log",
                    last_message="blocked",
                )

            runner._codex.invoke = Mock(side_effect=block_step)

            with self.assertRaisesRegex(BlockedStep, "needs user"):
                runner._execute_single_step(StepConfig(0, "setup", "pending", 3, 1800), "guardrails")

            updated = read_json(index_file)
            top = read_json(root / "phases" / "index.json")
            self.assertTrue(live_log.exists())
            self.assertIn("blocked_at", updated["steps"][0])
            self.assertEqual(top["phases"][0]["status"], "blocked")
            runner._git_ops.commit_step.assert_not_called()

    def test_retry_prompt_receives_previous_error_and_respects_step_config(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._write_phase(
                root,
                [{"step": 0, "name": "setup", "status": "pending", "max_attempts": 2, "timeout_sec": 60}],
            )
            phase_dir = root / "phases" / "0-demo"
            index_file = phase_dir / "index.json"
            runner = self._direct_runner(root)
            prompts: list[str] = []
            attempts: list[int] = []

            def invoke(step: StepConfig, prompt: str, attempt: int) -> CodexRunResult:
                self.assertEqual(step.timeout_sec, 60)
                prompts.append(prompt)
                attempts.append(attempt)
                if attempt == 1:
                    index = read_json(index_file)
                    index["steps"][0]["status"] = "error"
                    index["steps"][0]["error_message"] = "agent reported failure"
                    write_json(index_file, index)
                    return CodexRunResult(
                        exit_code=1,
                        live_log_path="phases/0-demo/step0-live.log",
                        last_message="working",
                        commands=["npm test"],
                        stderr_tail=["boom"],
                    )
                index = read_json(index_file)
                self.assertEqual(index["steps"][0]["status"], "pending")
                self.assertNotIn("error_message", index["steps"][0])
                index["steps"][0]["status"] = "completed"
                index["steps"][0]["summary"] = "done"
                write_json(index_file, index)
                return CodexRunResult(
                    exit_code=0,
                    live_log_path="phases/0-demo/step0-live.log",
                    last_message="done",
                )

            runner._codex.invoke = Mock(side_effect=invoke)

            runner._execute_single_step(StepConfig(0, "setup", "pending", 2, 60), "guardrails")

            self.assertEqual(attempts, [1, 2])
            self.assertIn("agent reported failure", prompts[1])
            self.assertIn("Live log: phases/0-demo/step0-live.log", prompts[1])
            self.assertIn("stderr tail: boom", prompts[1])
            runner._git_ops.commit_step.assert_called_once_with(0, "setup")

    def test_finalize_delegates_metadata_commit_and_optional_push(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._write_phase(root, [], top_status="pending")
            runner = self._direct_runner(root, auto_push=True)

            runner._finalize()

            top = read_json(root / "phases" / "index.json")
            self.assertEqual(top["phases"][0]["status"], "completed")
            runner._git_ops.commit_phase_completed.assert_called_once_with()
            runner._git_ops.push_phase_branch.assert_called_once_with()

    def _direct_runner(self, root: Path, *, auto_push: bool = False) -> HarnessRunner:
        runner = HarnessRunner(HarnessConfig(root, "0-demo", auto_push))
        runner._git_ops = Mock()
        runner._codex = CodexClient(
            root_path=root,
            phase_dir_path=root / "phases" / "0-demo",
            timestamp=lambda: "2026-06-02T00:00:00+0900",
        )
        runner._total = len(read_json(root / "phases" / "0-demo" / "index.json")["steps"])
        return runner

    def _write_phase(
        self,
        root: Path,
        steps: list[dict],
        *,
        phase_name: str = "0-demo",
        top_status: str = "pending",
    ) -> None:
        phases_dir = root / "phases"
        phase_dir = phases_dir / phase_name
        phase_dir.mkdir(parents=True)
        write_json(phases_dir / "index.json", {"phases": [{"dir": phase_name, "status": top_status}]})
        write_json(
            phase_dir / "index.json",
            {"project": "SolveSync", "phase": phase_name, "steps": steps},
        )
        for step in steps:
            (phase_dir / f"step{step['step']}.md").write_text(
                f"# Step {step['step']}: {step['name']}\n",
                encoding="utf-8",
            )


if __name__ == "__main__":
    unittest.main()
