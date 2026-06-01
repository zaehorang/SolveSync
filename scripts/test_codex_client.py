from __future__ import annotations

import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.harness.phase_index import StepConfig


class FakeProcess:
    def __init__(self, stdout: str = "", stderr: str = "", *, exit_code: int = 0, running: bool = False):
        self.stdout = io.StringIO(stdout)
        self.stderr = io.StringIO(stderr)
        self.exit_code = exit_code
        self.running = running
        self.killed = False

    def poll(self):
        if self.running and not self.killed:
            return None
        return self.exit_code

    def wait(self):
        return self.exit_code

    def kill(self):
        self.killed = True


class CodexClientTests(unittest.TestCase):
    def test_invoke_preserves_codex_command_shape_and_live_log_contract(self):
        from scripts.harness import codex_client

        stdout_line = json.dumps(
            {
                "type": "agent_message",
                "message": {"content": [{"text": "working"}]},
                "tool_input": {"cmd": "npm test"},
            },
            ensure_ascii=False,
        )
        process = FakeProcess(stdout_line + "\n", "warning\n")

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            phase_dir = root / "phases" / "demo"
            phase_dir.mkdir(parents=True)
            client = codex_client.CodexClient(
                root_path=root,
                phase_dir_path=phase_dir,
                timestamp=lambda: "2026-06-02T00:00:00+0900",
            )
            step = StepConfig(0, "setup", "pending", 3, 1800)

            with patch.object(codex_client.subprocess, "Popen", return_value=process) as popen:
                result = client.invoke(step, "prompt text", 2)

            popen.assert_called_once_with(
                [
                    "codex",
                    "exec",
                    "--json",
                    "--sandbox",
                    "danger-full-access",
                    "-c",
                    'approval_policy="never"',
                    "--cd",
                    str(root),
                    "prompt text",
                ],
                cwd=str(root),
                stdout=codex_client.subprocess.PIPE,
                stderr=codex_client.subprocess.PIPE,
                text=True,
                bufsize=1,
            )
            self.assertEqual(result.exit_code, 0)
            self.assertEqual(result.live_log_path, "phases/demo/step0-live.log")
            self.assertEqual(result.last_message, "working")
            self.assertEqual(result.commands, ["npm test"])
            self.assertEqual(result.stderr_tail, ["warning"])

            live_log_lines = (phase_dir / "step0-live.log").read_text(encoding="utf-8").splitlines()
            self.assertEqual(
                json.loads(live_log_lines[0]),
                {
                    "stream": "harness",
                    "event": "start",
                    "step": 0,
                    "name": "setup",
                    "attempt": 2,
                    "createdAt": "2026-06-02T00:00:00+0900",
                },
            )
            self.assertEqual(live_log_lines[1], stdout_line)
            self.assertEqual(json.loads(live_log_lines[2]), {"stream": "stderr", "line": "warning"})

    def test_timeout_uses_step_timeout_and_normalizes_zero_exit_to_124(self):
        from scripts.harness import codex_client

        process = FakeProcess(exit_code=0, running=True)

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            phase_dir = root / "phases" / "demo"
            phase_dir.mkdir(parents=True)
            client = codex_client.CodexClient(
                root_path=root,
                phase_dir_path=phase_dir,
                timestamp=lambda: "2026-06-02T00:00:00+0900",
            )
            step = StepConfig(1, "timeout", "pending", 3, 0)

            with patch.object(codex_client.subprocess, "Popen", return_value=process):
                result = client.invoke(step, "prompt", 1)

            self.assertTrue(process.killed)
            self.assertEqual(result.exit_code, 124)
            self.assertIn("codex exec timed out after 0 seconds", result.stderr_tail)
            events = [
                json.loads(line)
                for line in (phase_dir / "step1-live.log").read_text(encoding="utf-8").splitlines()
            ]
            self.assertIn(
                {
                    "stream": "harness",
                    "event": "timeout",
                    "message": "codex exec timed out after 0 seconds",
                },
                events,
            )

    def test_delete_live_log_removes_existing_log_and_ignores_missing_log(self):
        from scripts.harness import codex_client

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            phase_dir = root / "phases" / "demo"
            phase_dir.mkdir(parents=True)
            live_log = phase_dir / "step2-live.log"
            live_log.write_text("log", encoding="utf-8")
            client = codex_client.CodexClient(
                root_path=root,
                phase_dir_path=phase_dir,
                timestamp=lambda: "2026-06-02T00:00:00+0900",
            )

            client.delete_live_log(2)
            client.delete_live_log(2)

            self.assertFalse(live_log.exists())

    def test_format_retry_error_matches_existing_runner_summary_shape(self):
        from scripts.harness import codex_client

        client = codex_client.CodexClient(
            root_path=Path("/repo"),
            phase_dir_path=Path("/repo/phases/demo"),
            timestamp=lambda: "2026-06-02T00:00:00+0900",
        )
        result = codex_client.CodexRunResult(
            exit_code=1,
            live_log_path="phases/demo/step0-live.log",
            last_message="working",
            commands=["c0", "c1", "c2", "c3", "c4", "c5"],
            stderr_tail=["e0", "e1", "e2", "e3", "e4", "e5"],
            elapsed_sec=3,
        )

        message = client.format_retry_error("previous failure", result)

        self.assertIn("previous failure", message)
        self.assertIn("Codex exit code: 1", message)
        self.assertIn("Live log: phases/demo/step0-live.log", message)
        self.assertIn("Observed commands: c1; c2; c3; c4; c5", message)
        self.assertIn("stderr tail: e1 | e2 | e3 | e4 | e5", message)
        self.assertNotIn("c0", message)
        self.assertNotIn("e0", message)

    def test_event_parsing_helpers_preserve_summary_and_tail_behavior(self):
        from scripts.harness import codex_client

        line = json.dumps(
            {
                "type": "agent_event",
                "message": {"content": [{"text": "Installing dependencies"}]},
                "tool_input": {"cmd": "npm install"},
                "error": {"message": "failed"},
            }
        )

        self.assertEqual(
            codex_client._summarize_codex_line(line),
            {
                "message": "Installing dependencies",
                "command": "npm install",
                "error": "failed",
            },
        )
        self.assertEqual(codex_client._summarize_codex_line("not json"), {})
        self.assertEqual(codex_client._truncate("one\n two\tthree", 20), "one two three")

        tail: list[str] = []
        for index in range(25):
            codex_client._append_tail(tail, f"line {index}\n")
        codex_client._append_tail(tail, "\n")

        self.assertEqual(len(tail), 20)
        self.assertEqual(tail[0], "line 5")
        self.assertEqual(tail[-1], "line 24")

    def test_default_heartbeat_interval_stays_sixty_seconds(self):
        from scripts.harness import codex_client

        self.assertEqual(codex_client.DEFAULT_HEARTBEAT_INTERVAL_SEC, 60)


if __name__ == "__main__":
    unittest.main()
