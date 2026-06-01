import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import call, patch


def _load_quality_gate_module():
    spec = importlib.util.spec_from_file_location("quality_gate_module", Path(__file__).with_name("quality_gate.py"))
    if spec is None or spec.loader is None:
        raise RuntimeError("quality_gate.py module spec could not be loaded")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


quality_gate = _load_quality_gate_module()


class QualityGateCommandTests(unittest.TestCase):
    def test_node_commands_include_typecheck_lint_test_and_build_in_order(self):
        package_json = {
            "scripts": {
                "build": "vite build",
                "lint": "eslint .",
                "test": "vitest run",
                "typecheck": "tsc --noEmit",
            }
        }

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "package.json").write_text(json.dumps(package_json), encoding="utf-8")
            (root / "package-lock.json").write_text("{}", encoding="utf-8")

            with patch.object(quality_gate, "ROOT", root), patch.object(quality_gate.shutil, "which", return_value="/usr/bin/npm"):
                self.assertEqual(
                    quality_gate._node_commands(),
                    [
                        ["npm", "run", "typecheck"],
                        ["npm", "run", "lint"],
                        ["npm", "run", "test"],
                        ["npm", "run", "build"],
                    ],
                )

    def test_python_commands_include_unittest_discover_for_script_tests(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            scripts_dir = root / "scripts"
            scripts_dir.mkdir()
            (scripts_dir / "test_harness.py").write_text("import unittest\n", encoding="utf-8")

            with (
                patch.object(quality_gate, "ROOT", root),
                patch.object(quality_gate.shutil, "which", return_value=None),
                patch.dict(os.environ, {}, clear=True),
            ):
                self.assertEqual(
                    quality_gate._python_commands(),
                    [["python3", "-m", "unittest", "discover", "-s", "scripts", "-p", "test_*.py"]],
                )

    def test_python_commands_skip_unittest_when_quality_gate_env_is_set(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            scripts_dir = root / "scripts"
            scripts_dir.mkdir()
            (scripts_dir / "test_harness.py").write_text("import unittest\n", encoding="utf-8")

            with (
                patch.object(quality_gate, "ROOT", root),
                patch.object(quality_gate.shutil, "which", return_value=None),
                patch.dict(os.environ, {"SOLVESYNC_QUALITY_GATE_RUNNING": "1"}, clear=True),
            ):
                self.assertEqual(quality_gate._python_commands(), [])

    def test_run_passes_quality_gate_env_to_child_command(self):
        completed = quality_gate.subprocess.CompletedProcess(["cmd"], 0)

        with patch.object(quality_gate.subprocess, "run", return_value=completed) as run:
            code = quality_gate._run(["echo", "ok"])

        self.assertEqual(code, 0)
        run.assert_called_once()
        env = run.call_args.kwargs["env"]
        self.assertEqual(env["SOLVESYNC_QUALITY_GATE_RUNNING"], "1")

    def test_main_preserves_node_order_and_runs_unittest_before_swift(self):
        commands = [
            ["npm", "run", "typecheck"],
            ["npm", "run", "lint"],
            ["npm", "run", "test"],
            ["npm", "run", "build"],
            ["python3", "-m", "unittest", "discover", "-s", "scripts", "-p", "test_*.py"],
            ["swift", "test"],
        ]

        with (
            patch.object(quality_gate, "_node_commands", return_value=commands[:4]),
            patch.object(quality_gate, "_python_commands", return_value=[commands[4]]),
            patch.object(quality_gate, "_swift_commands", return_value=[commands[5]]),
            patch.object(quality_gate, "_run", return_value=0) as run,
        ):
            self.assertEqual(quality_gate.main(), 0)

        self.assertEqual(run.call_args_list, [call(command) for command in commands])


if __name__ == "__main__":
    unittest.main()
