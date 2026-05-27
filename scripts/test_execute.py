import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


def _load_execute_module():
    spec = importlib.util.spec_from_file_location("execute_module", Path(__file__).with_name("execute.py"))
    if spec is None or spec.loader is None:
        raise RuntimeError("execute.py module spec could not be loaded")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


execute = _load_execute_module()


class StepExecutorHelperTests(unittest.TestCase):
    def _make_executor(self, root: Path, phase_name: str = "demo"):
        old_root = execute.ROOT
        execute.ROOT = root
        self.addCleanup(setattr, execute, "ROOT", old_root)
        return execute.StepExecutor(phase_name)

    def test_build_step_context_includes_completed_steps_with_summary(self):
        index = {
            "steps": [
                {"step": 0, "name": "setup", "status": "completed", "summary": "created base files"},
                {"step": 1, "name": "api", "status": "completed"},
                {"step": 2, "name": "ui", "status": "pending", "summary": "not yet done"},
            ]
        }

        context = execute.StepExecutor._build_step_context(index)

        self.assertIn("## 이전 Step 산출물", context)
        self.assertIn("- Step 0 (setup): created base files", context)
        self.assertNotIn("api", context)
        self.assertNotIn("not yet done", context)

    def test_json_helpers_round_trip_non_ascii_values(self):
        payload = {"status": "completed", "summary": "한글 요약"}

        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "index.json"
            execute.StepExecutor._write_json(path, payload)

            self.assertEqual(json.loads(path.read_text(encoding="utf-8")), payload)
            self.assertEqual(execute.StepExecutor._read_json(path), payload)

    def test_build_preamble_keeps_commit_responsibility_in_runner(self):
        executor = object.__new__(execute.StepExecutor)
        executor._project = "PS-LP-Sync"
        executor._phase_dir_name = "0-mvp"

        preamble = executor._build_preamble("guardrails", "", None)

        self.assertIn("git commit을 실행하지 마라", preamble)
        self.assertIn("scripts/execute.py runner", preamble)
        self.assertNotIn("모든 변경사항을 커밋하라", preamble)

    def test_summarize_codex_line_extracts_message_and_command(self):
        line = json.dumps({
            "type": "agent_event",
            "message": {"content": [{"text": "Installing dependencies"}]},
            "tool_input": {"cmd": "npm install"},
        })

        summary = execute.StepExecutor._summarize_codex_line(line)

        self.assertEqual(summary["message"], "Installing dependencies")
        self.assertEqual(summary["command"], "npm install")

    def test_summarize_codex_line_ignores_unknown_text(self):
        self.assertEqual(execute.StepExecutor._summarize_codex_line("not json"), {})

    def test_heartbeat_interval_starts_after_one_minute(self):
        source = Path(__file__).with_name("execute.py").read_text(encoding="utf-8")

        self.assertEqual(execute.StepExecutor.HEARTBEAT_INTERVAL_SEC, 60)
        self.assertIn("next_heartbeat = started + self.HEARTBEAT_INTERVAL_SEC", source)

    def test_invoke_codex_returns_summary_without_writing_output_json(self):
        class FakeProcess:
            def __init__(self):
                self.stdout = io.StringIO(json.dumps({
                    "type": "agent_message",
                    "message": "working",
                    "tool_input": {"cmd": "npm test"},
                }) + "\n")
                self.stderr = io.StringIO("")

            def poll(self):
                return 0

            def wait(self):
                return 0

            def kill(self):
                return None

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            phase_dir = root / "phases" / "demo"
            phase_dir.mkdir(parents=True)
            (phase_dir / "index.json").write_text(
                json.dumps({
                    "project": "PS-LP-Sync",
                    "phase": "demo",
                    "steps": [{"step": 0, "name": "setup", "status": "pending"}],
                }),
                encoding="utf-8",
            )
            (phase_dir / "step0.md").write_text("# Step 0\n", encoding="utf-8")
            executor = self._make_executor(root)

            with patch.object(execute.subprocess, "Popen", return_value=FakeProcess()):
                output = executor._invoke_codex({"step": 0, "name": "setup"}, "preamble", 1)

            self.assertEqual(output["lastMessage"], "working")
            self.assertEqual(output["commands"], ["npm test"])
            self.assertTrue((phase_dir / "step0-live.log").exists())
            self.assertFalse((phase_dir / "step0-output.json").exists())

    def test_commit_step_excludes_live_log_without_output_json_path(self):
        executor = object.__new__(execute.StepExecutor)
        executor._phase_dir_name = "demo"
        executor._phase_name = "demo"
        calls = []

        def run_git(*args):
            calls.append(args)
            return execute.subprocess.CompletedProcess(["git", *args], 0, "", "")

        with patch.object(executor, "_run_git", side_effect=run_git):
            executor._commit_step(2, "setup")

        self.assertGreaterEqual(calls.count(("reset", "HEAD", "--", "phases/demo/step2-live.log")), 2)
        self.assertNotIn("phases/demo/step2-output.json", " ".join(" ".join(call) for call in calls))

    def test_is_already_completed_uses_top_level_phase_status(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            phase_dir = root / "phases" / "demo"
            phase_dir.mkdir(parents=True)
            (root / "phases" / "index.json").write_text(
                json.dumps({"phases": [{"dir": "demo", "status": "completed"}]}),
                encoding="utf-8",
            )
            (phase_dir / "index.json").write_text(
                json.dumps({
                    "project": "PS-LP-Sync",
                    "phase": "demo",
                    "steps": [{"step": 0, "name": "setup", "status": "completed"}],
                }),
                encoding="utf-8",
            )

            executor = self._make_executor(root)

            self.assertTrue(executor._is_already_completed())

    def test_execute_all_steps_finalizes_completed_step_without_rerunning_agent(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            phase_dir = root / "phases" / "demo"
            phase_dir.mkdir(parents=True)
            (root / "phases" / "index.json").write_text(
                json.dumps({"phases": [{"dir": "demo", "status": "pending"}]}),
                encoding="utf-8",
            )
            (phase_dir / "index.json").write_text(
                json.dumps({
                    "project": "PS-LP-Sync",
                    "phase": "demo",
                    "steps": [{"step": 0, "name": "setup", "status": "completed"}],
                }),
                encoding="utf-8",
            )
            live_log = phase_dir / "step0-live.log"
            live_log.write_text("log", encoding="utf-8")
            executor = self._make_executor(root)
            committed = []

            with patch.object(executor, "_commit_step", side_effect=lambda step, name: committed.append((step, name))):
                executor._execute_all_steps("guardrails")

            updated = json.loads((phase_dir / "index.json").read_text(encoding="utf-8"))
            self.assertIn("completed_at", updated["steps"][0])
            self.assertEqual(committed, [(0, "setup")])
            self.assertFalse(live_log.exists())

    def test_completed_step_deletes_live_log_after_commit(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            phase_dir = root / "phases" / "demo"
            phase_dir.mkdir(parents=True)
            (root / "phases" / "index.json").write_text(
                json.dumps({"phases": [{"dir": "demo", "status": "pending"}]}),
                encoding="utf-8",
            )
            index_file = phase_dir / "index.json"
            index_file.write_text(
                json.dumps({
                    "project": "PS-LP-Sync",
                    "phase": "demo",
                    "steps": [{"step": 0, "name": "setup", "status": "pending"}],
                }),
                encoding="utf-8",
            )
            live_log = phase_dir / "step0-live.log"
            live_log.write_text("log", encoding="utf-8")
            executor = self._make_executor(root)

            def complete_step(_step, _preamble, _attempt):
                index = json.loads(index_file.read_text(encoding="utf-8"))
                index["steps"][0]["status"] = "completed"
                index["steps"][0]["summary"] = "done"
                index_file.write_text(json.dumps(index), encoding="utf-8")
                return {"elapsedSec": 0, "exitCode": 0, "liveLogPath": "phases/demo/step0-live.log"}

            with (
                patch.object(executor, "_invoke_codex", side_effect=complete_step),
                patch.object(executor, "_commit_step"),
            ):
                self.assertTrue(executor._execute_single_step({"step": 0, "name": "setup"}, "guardrails"))

            self.assertFalse(live_log.exists())

    def test_failed_step_preserves_live_log(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            phase_dir = root / "phases" / "demo"
            phase_dir.mkdir(parents=True)
            (root / "phases" / "index.json").write_text(
                json.dumps({"phases": [{"dir": "demo", "status": "pending"}]}),
                encoding="utf-8",
            )
            (phase_dir / "index.json").write_text(
                json.dumps({
                    "project": "PS-LP-Sync",
                    "phase": "demo",
                    "steps": [{"step": 0, "name": "setup", "status": "pending"}],
                }),
                encoding="utf-8",
            )
            live_log = phase_dir / "step0-live.log"
            live_log.write_text("log", encoding="utf-8")
            executor = self._make_executor(root)
            executor.MAX_RETRIES = 1

            with (
                patch.object(executor, "_invoke_codex", return_value={
                    "elapsedSec": 0,
                    "exitCode": 1,
                    "liveLogPath": "phases/demo/step0-live.log",
                    "commands": ["npm test"],
                    "stderrTail": ["boom"],
                }),
                patch.object(executor, "_commit_step"),
            ):
                with self.assertRaises(SystemExit) as raised:
                    executor._execute_single_step({"step": 0, "name": "setup"}, "guardrails")

            self.assertEqual(raised.exception.code, 1)
            self.assertTrue(live_log.exists())


if __name__ == "__main__":
    unittest.main()
