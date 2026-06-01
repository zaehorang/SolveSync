from __future__ import annotations

import importlib.util
import io
import subprocess
import unittest
from pathlib import Path
from unittest.mock import call, patch


def _load_quality_gate_module():
    module_path = Path(__file__).resolve().parents[1] / "quality_gate.py"
    spec = importlib.util.spec_from_file_location("quality_gate_module", module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError("quality_gate.py module spec could not be loaded")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


quality_gate = _load_quality_gate_module()


class QualityGateCommandTests(unittest.TestCase):
    def test_commands_are_fixed_solvesync_product_gate(self):
        self.assertEqual(
            quality_gate.COMMANDS,
            [
                ["npm", "run", "typecheck"],
                ["npm", "test"],
                ["npm", "run", "build"],
            ],
        )

    def test_run_uses_repo_root_cwd_without_extra_environment(self):
        completed = subprocess.CompletedProcess(["npm", "test"], 0)

        with (
            patch.object(quality_gate.subprocess, "run", return_value=completed) as run,
            patch("sys.stdout", new_callable=io.StringIO),
        ):
            code = quality_gate._run(["npm", "test"])

        self.assertEqual(code, 0)
        run.assert_called_once_with(["npm", "test"], cwd=quality_gate.ROOT)
        self.assertNotIn("env", run.call_args.kwargs)

    def test_run_returns_one_when_npm_cannot_spawn(self):
        with (
            patch.object(quality_gate.subprocess, "run", side_effect=FileNotFoundError("missing npm")),
            patch("sys.stdout", new_callable=io.StringIO),
            patch("sys.stderr", new_callable=io.StringIO) as stderr,
        ):
            code = quality_gate._run(["npm", "test"])

        self.assertEqual(code, 1)
        self.assertIn("unable to execute npm", stderr.getvalue())

    def test_main_runs_commands_in_order(self):
        with patch.object(quality_gate, "_run", return_value=0) as run:
            self.assertEqual(quality_gate.main(), 0)

        self.assertEqual(run.call_args_list, [call(command) for command in quality_gate.COMMANDS])

    def test_main_stops_on_first_failed_command(self):
        def run(command: list[str]) -> int:
            return 17 if command == ["npm", "test"] else 0

        with (
            patch.object(quality_gate, "_run", side_effect=run) as runner,
            patch("sys.stderr", new_callable=io.StringIO),
        ):
            self.assertEqual(quality_gate.main(), 17)

        self.assertEqual(runner.call_args_list, [call(quality_gate.COMMANDS[0]), call(quality_gate.COMMANDS[1])])


if __name__ == "__main__":
    unittest.main()
