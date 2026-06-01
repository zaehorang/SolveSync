from __future__ import annotations

import io
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import scripts.execute as execute
from scripts.harness.errors import BlockedStep, FailedStep, GitOperationError, PhaseValidationError
from scripts.harness.runner import HarnessConfig


class ExecuteCliTests(unittest.TestCase):
    def test_script_help_runs_when_invoked_by_path_from_repo_root(self):
        root = Path(__file__).resolve().parent.parent

        result = subprocess.run(
            ["python3", "scripts/execute.py", "--help"],
            cwd=str(root),
            capture_output=True,
            text=True,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("phase_dir", result.stdout)

    def test_main_invokes_harness_runner_with_phase_dir_and_push_flag(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            with (
                patch.object(execute, "ROOT", root),
                patch.object(execute, "HarnessRunner") as harness_runner,
            ):
                code = execute.main(["demo", "--push"])

        self.assertEqual(code, 0)
        harness_runner.assert_called_once_with(HarnessConfig(root, "demo", True))
        harness_runner.return_value.run.assert_called_once_with()

    def test_main_keeps_push_default_false(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            with (
                patch.object(execute, "ROOT", root),
                patch.object(execute, "HarnessRunner") as harness_runner,
            ):
                code = execute.main(["demo"])

        self.assertEqual(code, 0)
        harness_runner.assert_called_once_with(HarnessConfig(root, "demo", False))

    def test_main_maps_blocked_step_to_exit_code_two(self):
        code, output = self._run_with_error(BlockedStep("needs input"))

        self.assertEqual(code, 2)
        self.assertIn("BLOCKED", output)
        self.assertIn("needs input", output)

    def test_main_maps_typed_failures_to_exit_code_one(self):
        cases = [
            GitOperationError("git failed"),
            PhaseValidationError("invalid phase"),
            FailedStep("step failed"),
        ]

        for exc in cases:
            with self.subTest(exc=type(exc).__name__):
                code, output = self._run_with_error(exc)

            self.assertEqual(code, 1)
            self.assertIn("ERROR", output)
            self.assertIn(str(exc), output)

    def _run_with_error(self, exc: Exception) -> tuple[int, str]:
        with (
            patch.object(execute, "HarnessRunner") as harness_runner,
            patch("sys.stdout", new_callable=io.StringIO) as stdout,
        ):
            harness_runner.return_value.run.side_effect = exc
            code = execute.main(["demo"])

        return code, stdout.getvalue()


if __name__ == "__main__":
    unittest.main()
