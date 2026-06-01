from __future__ import annotations

import json
import re
import tempfile
import unittest
from pathlib import Path

from scripts.harness.errors import PhaseValidationError
from scripts.harness.phase_index import (
    DEFAULT_MAX_ATTEMPTS,
    DEFAULT_TIMEOUT_SEC,
    StepConfig,
    build_step_context,
    load_guardrails,
    load_step_configs,
    read_json,
    stamp,
    validate_phase_indexes,
    write_json,
)


ROOT = Path(__file__).resolve().parent.parent


class PhaseIndexHelperTests(unittest.TestCase):
    def test_json_helpers_round_trip_non_ascii_values(self):
        payload = {"status": "completed", "summary": "한글 요약"}

        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "index.json"
            write_json(path, payload)

            self.assertEqual(json.loads(path.read_text(encoding="utf-8")), payload)
            self.assertEqual(read_json(path), payload)

    def test_stamp_uses_existing_kst_format(self):
        self.assertRegex(stamp(), re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+0900$"))

    def test_load_guardrails_includes_agents_and_sorted_docs_with_separators(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            docs_dir = root / "docs"
            docs_dir.mkdir()
            (root / "AGENTS.md").write_text("agent guardrails", encoding="utf-8")
            (docs_dir / "B.md").write_text("second doc", encoding="utf-8")
            (docs_dir / "A.md").write_text("first doc", encoding="utf-8")

            guardrails = load_guardrails(root)

        self.assertIn("## 프로젝트 규칙 (AGENTS.md)", guardrails)
        self.assertIn("agent guardrails", guardrails)
        self.assertLess(guardrails.index("## A"), guardrails.index("## B"))
        self.assertIn("\n\n---\n\n", guardrails)

    def test_build_step_context_matches_runner_completed_summary_format(self):
        index = {
            "steps": [
                {"step": 0, "name": "setup", "status": "completed", "summary": "created base files"},
                {"step": 1, "name": "api", "status": "completed"},
                {"step": 2, "name": "ui", "status": "pending", "summary": "not yet done"},
            ]
        }

        self.assertEqual(
            build_step_context(index),
            "## 이전 Step 산출물\n\n- Step 0 (setup): created base files\n\n",
        )

    def test_existing_phase_files_pass_validation(self):
        top_index = read_json(ROOT / "phases" / "index.json")

        for phase in top_index["phases"]:
            with self.subTest(phase=phase["dir"]):
                validate_phase_indexes(ROOT, phase["dir"])

    def test_load_step_configs_applies_defaults_and_custom_values(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._write_phase(
                root,
                "demo",
                [
                    {"step": 0, "name": "setup", "status": "pending"},
                    {
                        "step": 1,
                        "name": "api",
                        "status": "pending",
                        "max_attempts": 5,
                        "timeout_sec": 60,
                    },
                ],
            )

            configs = load_step_configs(root, "demo")

        self.assertEqual(
            configs,
            [
                StepConfig(0, "setup", "pending", DEFAULT_MAX_ATTEMPTS, DEFAULT_TIMEOUT_SEC),
                StepConfig(1, "api", "pending", 5, 60),
            ],
        )

    def test_validate_phase_indexes_requires_registered_phase(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._write_phase(root, "demo", [{"step": 0, "name": "setup", "status": "pending"}])
            write_json(root / "phases" / "index.json", {"phases": []})

            with self.assertRaisesRegex(PhaseValidationError, "not registered"):
                validate_phase_indexes(root, "demo")

    def test_validate_phase_indexes_requires_matching_phase_name(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._write_phase(
                root,
                "demo",
                [{"step": 0, "name": "setup", "status": "pending"}],
                phase_value="other",
            )

            with self.assertRaisesRegex(PhaseValidationError, "phase must be"):
                validate_phase_indexes(root, "demo")

    def test_validate_phase_indexes_requires_consecutive_steps(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._write_phase(root, "demo", [{"step": 1, "name": "setup", "status": "pending"}])

            with self.assertRaisesRegex(PhaseValidationError, "consecutive"):
                validate_phase_indexes(root, "demo")

    def test_validate_phase_indexes_requires_step_markdown_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._write_phase(root, "demo", [{"step": 0, "name": "setup", "status": "pending"}])
            (root / "phases" / "demo" / "step0.md").unlink()

            with self.assertRaisesRegex(PhaseValidationError, "step0.md"):
                validate_phase_indexes(root, "demo")

    def test_validate_phase_indexes_rejects_invalid_status(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._write_phase(root, "demo", [{"step": 0, "name": "setup", "status": "running"}])

            with self.assertRaisesRegex(PhaseValidationError, "status"):
                validate_phase_indexes(root, "demo")

    def test_validate_phase_indexes_requires_completed_summary(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._write_phase(root, "demo", [{"step": 0, "name": "setup", "status": "completed"}])

            with self.assertRaisesRegex(PhaseValidationError, "summary"):
                validate_phase_indexes(root, "demo")

    def test_validate_phase_indexes_rejects_non_positive_attempt_and_timeout(self):
        invalid_cases = [
            ("max_attempts", 0),
            ("max_attempts", True),
            ("timeout_sec", -1),
            ("timeout_sec", "1800"),
        ]

        for key, value in invalid_cases:
            with self.subTest(key=key, value=value), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                self._write_phase(
                    root,
                    "demo",
                    [{"step": 0, "name": "setup", "status": "pending", key: value}],
                )

                with self.assertRaisesRegex(PhaseValidationError, key):
                    validate_phase_indexes(root, "demo")

    def _write_phase(
        self,
        root: Path,
        phase_name: str,
        steps: list[dict],
        *,
        phase_value: str | None = None,
    ) -> None:
        phases_dir = root / "phases"
        phase_dir = phases_dir / phase_name
        phase_dir.mkdir(parents=True)
        write_json(phases_dir / "index.json", {"phases": [{"dir": phase_name, "status": "pending"}]})
        write_json(
            phase_dir / "index.json",
            {"project": "SolveSync", "phase": phase_value or phase_name, "steps": steps},
        )
        for step in steps:
            (phase_dir / f"step{step['step']}.md").write_text("# Step\n", encoding="utf-8")


if __name__ == "__main__":
    unittest.main()
