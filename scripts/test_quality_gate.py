import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


def _load_quality_gate_module():
    spec = importlib.util.spec_from_file_location("quality_gate_module", Path(__file__).with_name("quality_gate.py"))
    if spec is None or spec.loader is None:
        raise RuntimeError("quality_gate.py module spec could not be loaded")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


quality_gate = _load_quality_gate_module()


class QualityGateCommandTests(unittest.TestCase):
    def test_node_commands_include_typecheck_before_test_and_build(self):
        package_json = {
            "scripts": {
                "build": "vite build",
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
                        ["npm", "run", "test"],
                        ["npm", "run", "build"],
                    ],
                )


if __name__ == "__main__":
    unittest.main()
