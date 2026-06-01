from __future__ import annotations

import importlib.util
import subprocess
import unittest
from pathlib import Path
from unittest.mock import patch


def _load_harness_self_test_module():
    module_path = Path(__file__).resolve().parents[1] / "harness_self_test.py"
    spec = importlib.util.spec_from_file_location("harness_self_test_module", module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError("harness_self_test.py module spec could not be loaded")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


harness_self_test = _load_harness_self_test_module()


class HarnessSelfTestCliTests(unittest.TestCase):
    def test_main_runs_unittest_discovery_and_returns_child_exit_code(self):
        completed = subprocess.CompletedProcess(["python"], 7)

        with (
            patch.object(harness_self_test.sys, "executable", "/python"),
            patch.object(harness_self_test.subprocess, "run", return_value=completed) as run,
        ):
            code = harness_self_test.main()

        self.assertEqual(code, 7)
        run.assert_called_once_with(
            [
                "/python",
                "-m",
                "unittest",
                "discover",
                "-s",
                "scripts/harness_tests",
                "-p",
                "test_*.py",
                "-t",
                ".",
            ],
            cwd=harness_self_test.ROOT,
        )


if __name__ == "__main__":
    unittest.main()
