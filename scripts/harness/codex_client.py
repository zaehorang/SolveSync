"""Codex subprocess client for the harness runner."""

from __future__ import annotations

import json
import queue
import subprocess
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Optional

from scripts.harness.phase_index import StepConfig

DEFAULT_HEARTBEAT_INTERVAL_SEC = 60
STDERR_TAIL_LIMIT = 20


@dataclass
class CodexRunResult:
    exit_code: int
    live_log_path: str
    last_message: str
    commands: list[str] = field(default_factory=list)
    stderr_tail: list[str] = field(default_factory=list)
    elapsed_sec: int = 0


class CodexClient:
    """Runs Codex headlessly and records raw event streams to a step live log."""

    def __init__(
        self,
        *,
        root_path: Path,
        phase_dir_path: Path,
        timestamp: Callable[[], str],
        heartbeat_interval_sec: int = DEFAULT_HEARTBEAT_INTERVAL_SEC,
    ):
        self._root_path = Path(root_path)
        self._phase_dir_path = Path(phase_dir_path)
        self._timestamp = timestamp
        self._heartbeat_interval_sec = heartbeat_interval_sec

    def invoke(self, step: StepConfig, prompt: str, attempt: int) -> CodexRunResult:
        live_log_path = self._live_log_path(step.step)
        result = CodexRunResult(
            exit_code=-1,
            live_log_path=self._relative_to_root(live_log_path),
            last_message="",
        )
        started = time.monotonic()
        events: queue.Queue[tuple[str, Optional[str]]] = queue.Queue()
        process = subprocess.Popen(
            [
                "codex",
                "exec",
                "--json",
                "--sandbox",
                "danger-full-access",
                "-c",
                'approval_policy="never"',
                "--cd",
                str(self._root_path),
                prompt,
            ],
            cwd=str(self._root_path),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
        )

        stdout_thread = threading.Thread(
            target=_read_pipe,
            args=("stdout", process.stdout, events),
            daemon=True,
        )
        stderr_thread = threading.Thread(
            target=_read_pipe,
            args=("stderr", process.stderr, events),
            daemon=True,
        )
        stdout_thread.start()
        stderr_thread.start()

        finished_streams: set[str] = set()
        deadline = started + step.timeout_sec
        next_heartbeat = started + self._heartbeat_interval_sec
        timed_out = False

        with open(live_log_path, "a", encoding="utf-8") as live_log:
            live_log.write(
                json.dumps(
                    {
                        "stream": "harness",
                        "event": "start",
                        "step": step.step,
                        "name": step.name,
                        "attempt": attempt,
                        "createdAt": self._timestamp(),
                    },
                    ensure_ascii=False,
                )
                + "\n"
            )
            live_log.flush()

            while len(finished_streams) < 2:
                now = time.monotonic()
                if not timed_out and now >= deadline and process.poll() is None:
                    timed_out = True
                    process.kill()
                    message = f"codex exec timed out after {step.timeout_sec} seconds"
                    _append_tail(result.stderr_tail, message)
                    live_log.write(
                        json.dumps(
                            {
                                "stream": "harness",
                                "event": "timeout",
                                "message": message,
                            },
                            ensure_ascii=False,
                        )
                        + "\n"
                    )
                    live_log.flush()

                try:
                    stream, line = events.get(timeout=0.5)
                except queue.Empty:
                    if now >= next_heartbeat:
                        elapsed = int(now - started)
                        print(
                            f"    ... {elapsed}s elapsed; live log: {result.live_log_path}",
                            flush=True,
                        )
                        next_heartbeat = now + self._heartbeat_interval_sec
                    continue

                if line is None:
                    finished_streams.add(stream)
                    continue

                if stream == "stdout":
                    live_log.write(line)
                    parsed = _summarize_codex_line(line)
                    if parsed.get("message") and parsed["message"] != result.last_message:
                        result.last_message = parsed["message"]
                        print(f"    agent: {result.last_message}", flush=True)
                    if parsed.get("command") and parsed["command"] not in result.commands:
                        result.commands.append(parsed["command"])
                        print(f"    command: {parsed['command']}", flush=True)
                    if parsed.get("error"):
                        _append_tail(result.stderr_tail, parsed["error"])
                        print(f"    error: {parsed['error']}", flush=True)
                else:
                    _append_tail(result.stderr_tail, line)
                    live_log.write(
                        json.dumps(
                            {
                                "stream": "stderr",
                                "line": line.rstrip("\n"),
                            },
                            ensure_ascii=False,
                        )
                        + "\n"
                    )
                live_log.flush()

        stdout_thread.join(timeout=1)
        stderr_thread.join(timeout=1)
        result.exit_code = process.wait()
        result.elapsed_sec = int(time.monotonic() - started)

        if timed_out and result.exit_code == 0:
            result.exit_code = 124

        if result.exit_code != 0:
            print(f"\n  WARN: Codex exited with non-zero status (code {result.exit_code})")
            if result.stderr_tail:
                print(f"  stderr tail: {_truncate(' | '.join(result.stderr_tail), 500)}")

        return result

    def delete_live_log(self, step_num: int) -> None:
        live_log_path = self._live_log_path(step_num)
        try:
            live_log_path.unlink()
        except FileNotFoundError:
            return
        except OSError as exc:
            print(f"  WARN: live log cleanup failed: {exc}")

    def format_retry_error(self, message: str, result: CodexRunResult) -> str:
        details = [message]
        if result.exit_code != 0:
            details.append(f"Codex exit code: {result.exit_code}")
        if result.live_log_path:
            details.append(f"Live log: {result.live_log_path}")
        if result.commands:
            details.append("Observed commands: " + "; ".join(result.commands[-5:]))
        if result.stderr_tail:
            details.append("stderr tail: " + " | ".join(result.stderr_tail[-5:]))
        return "\n".join(details)

    def _live_log_path(self, step_num: int) -> Path:
        return self._phase_dir_path / f"step{step_num}-live.log"

    def _relative_to_root(self, path: Path) -> str:
        try:
            return path.relative_to(self._root_path).as_posix()
        except ValueError:
            return str(path)


def _read_pipe(
    name: str,
    pipe: Any,
    events: queue.Queue[tuple[str, Optional[str]]],
) -> None:
    if pipe is None:
        events.put((name, None))
        return

    try:
        for line in iter(pipe.readline, ""):
            events.put((name, line))
    finally:
        events.put((name, None))


def _truncate(value: str, limit: int = 240) -> str:
    compact = " ".join(value.split())
    if len(compact) <= limit:
        return compact
    return compact[: limit - 1] + "…"


def _collect_values_for_keys(value: Any, keys: set[str], *, limit: int = 6) -> list[str]:
    found: list[str] = []

    def visit(node: Any) -> None:
        if len(found) >= limit:
            return
        if isinstance(node, dict):
            for key, child in node.items():
                lowered = str(key).lower()
                if lowered in keys:
                    text = _stringify_summary_value(child)
                    if text:
                        found.append(text)
                else:
                    visit(child)
        elif isinstance(node, list):
            for child in node:
                visit(child)

    visit(value)
    return found


def _stringify_summary_value(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list):
        parts = [_stringify_summary_value(item) for item in value]
        return " ".join(part for part in parts if part).strip()
    if isinstance(value, dict):
        for key in ("text", "message", "content", "summary", "value"):
            if key in value:
                text = _stringify_summary_value(value[key])
                if text:
                    return text
    return ""


def _summarize_codex_line(raw_line: str) -> dict:
    try:
        event = json.loads(raw_line)
    except json.JSONDecodeError:
        return {}

    if not isinstance(event, dict):
        return {}

    messages = _collect_values_for_keys(event, {"message", "text", "content", "summary"})
    commands = _collect_values_for_keys(event, {"command", "cmd"})
    errors = _collect_values_for_keys(event, {"error", "error_message"})

    summary: dict[str, str] = {}
    if messages:
        summary["message"] = _truncate(messages[0])
    if commands:
        summary["command"] = _truncate(commands[0])
    if errors:
        summary["error"] = _truncate(errors[0])
    return summary


def _append_tail(lines: list[str], line: str, limit: int = STDERR_TAIL_LIMIT) -> None:
    clean = line.rstrip("\n")
    if clean:
        lines.append(clean)
        del lines[:-limit]
