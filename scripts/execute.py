#!/usr/bin/env python3
"""
Codex Harness step 실행기.

phases/{phase}/index.json에서 pending step을 찾고, AGENTS.md와 docs/*.md,
이전 step summary, 현재 step 파일을 합쳐 codex exec headless 세션으로 실행한다.
step이 completed/error/blocked 상태를 기록할 때까지 최대 3회 재시도하며,
코드 변경 commit 전에는 scripts/quality_gate.py로 검증한다. 실행 중 원문 이벤트는
step별 live log에 남기고, 정상 완료된 step의 live log는 삭제한다.

Usage:
    python3 scripts/execute.py <phase-dir> [--push]
"""

import argparse
import json
import queue
import subprocess
import sys
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Optional

ROOT = Path(__file__).resolve().parent.parent


@dataclass
class CodexRunSummary:
    """실시간 Codex 실행에서 사람이 볼 만한 요약만 모은다."""

    exit_code: int = -1
    live_log_path: str = ""
    last_message: str = ""
    commands: list[str] = field(default_factory=list)
    stderr_tail: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "exitCode": self.exit_code,
            "liveLogPath": self.live_log_path,
            "lastMessage": self.last_message,
            "commands": self.commands,
            "stderrTail": self.stderr_tail,
        }


class StepExecutor:
    """Phase 디렉토리 안의 step들을 순차 실행하는 하네스."""

    MAX_RETRIES = 3
    HEARTBEAT_INTERVAL_SEC = 60
    FEAT_MSG = "feat({phase}): step {num} — {name}"
    CHORE_MSG = "chore({phase}): step {num} metadata"
    TZ = timezone(timedelta(hours=9))

    # 실행 대상 phase와 옵션을 검증하고, 이후 흐름에서 공통으로 쓰는 경로와 메타데이터를 준비한다.
    def __init__(self, phase_dir_name: str, *, auto_push: bool = False):
        self._root = str(ROOT)
        self._phases_dir = ROOT / "phases"
        self._phase_dir = self._phases_dir / phase_dir_name
        self._phase_dir_name = phase_dir_name
        self._top_index_file = self._phases_dir / "index.json"
        self._auto_push = auto_push

        if not self._phase_dir.is_dir():
            print(f"ERROR: {self._phase_dir} not found")
            sys.exit(1)

        self._index_file = self._phase_dir / "index.json"
        if not self._index_file.exists():
            print(f"ERROR: {self._index_file} not found")
            sys.exit(1)

        idx = self._read_json(self._index_file)
        self._project = idx.get("project", "project")
        self._phase_name = idx.get("phase", phase_dir_name)
        self._total = len(idx["steps"])

    # 하네스 실행의 최상위 흐름을 순서대로 조율한다.
    def run(self):
        # 실행 전 검증과 branch 준비를 끝낸 뒤, guardrail context를 만들어 모든 step에 주입한다.
        self._print_header()
        self._check_blockers()
        if self._is_already_completed():
            print("\n  Phase already completed; no pending runner work.")
            if self._auto_push:
                print("  Auto-push skipped because no work ran.")
            return
        self._checkout_branch()
        guardrails = self._load_guardrails()

        # phase timestamp를 보강하고 pending step을 모두 처리한 뒤 phase 완료 처리를 한다.
        self._ensure_created_at()
        self._execute_all_steps(guardrails)
        self._finalize()

    # --- timestamps ---

    # phase/step index에 기록할 KST 기준 timestamp 문자열을 만든다.
    def _stamp(self) -> str:
        return datetime.now(self.TZ).strftime("%Y-%m-%dT%H:%M:%S%z")

    # --- JSON I/O ---

    # JSON 파일을 dict로 읽어온다.
    @staticmethod
    def _read_json(p: Path) -> dict:
        return json.loads(p.read_text(encoding="utf-8"))

    # dict를 사람이 읽기 쉬운 JSON 파일로 저장한다.
    @staticmethod
    def _write_json(p: Path, data: dict):
        p.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

    # --- git ---

    # 저장소 루트에서 git 명령을 실행하고 결과를 호출자에게 돌려준다.
    def _run_git(self, *args) -> subprocess.CompletedProcess:
        cmd = ["git"] + list(args)
        return subprocess.run(cmd, cwd=self._root, capture_output=True, text=True)

    # phase 이름에 맞는 feature branch를 준비하고 checkout한다.
    def _checkout_branch(self):
        branch = f"feat-{self._phase_name}"

        # 먼저 git repository인지 확인하고 현재 branch가 이미 목표 branch인지 판단한다.
        r = self._run_git("rev-parse", "--git-dir")
        if r.returncode != 0:
            print("  ERROR: git을 사용할 수 없거나 git repo가 아닙니다.")
            print(f"  {r.stderr.strip()}")
            sys.exit(1)

        r = self._run_git("symbolic-ref", "--quiet", "--short", "HEAD")
        current_branch = r.stdout.strip() if r.returncode == 0 else ""

        if current_branch == branch:
            return

        # 기존 branch가 있으면 checkout하고, 없으면 새 branch를 만든다.
        r = self._run_git("rev-parse", "--verify", branch)
        r = self._run_git("checkout", branch) if r.returncode == 0 else self._run_git("checkout", "-b", branch)

        if r.returncode != 0:
            print(f"  ERROR: 브랜치 '{branch}' checkout 실패.")
            print(f"  {r.stderr.strip()}")
            print("  Hint: 변경사항을 stash하거나 commit한 후 다시 시도하세요.")
            sys.exit(1)

        print(f"  Branch: {branch}")

    # 커밋 직전에 프로젝트 품질 검증 스크립트를 실행한다.
    def _run_quality_gate(self) -> bool:
        gate = Path(self._root) / "scripts" / "quality_gate.py"
        if not gate.exists():
            return True

        r = subprocess.run([sys.executable, str(gate)], cwd=self._root, capture_output=True, text=True)
        if r.returncode == 0:
            return True

        print("\n  ERROR: quality gate failed before commit.")
        if r.stdout:
            print(r.stdout.strip())
        if r.stderr:
            print(r.stderr.strip())
        return False

    # step 실행으로 생긴 코드 변경과 하네스 산출물을 나눠 커밋한다.
    def _commit_step(self, step_num: int, step_name: str):
        live_log_rel = f"phases/{self._phase_dir_name}/step{step_num}-live.log"
        index_rel = f"phases/{self._phase_dir_name}/index.json"
        has_head = self._run_git("rev-parse", "--verify", "HEAD").returncode == 0

        # 전체 변경을 stage한 뒤, live log/index는 먼저 제외해서 코드 변경 커밋과 분리한다.
        self._run_git("add", "-A")
        if has_head:
            self._run_git("reset", "HEAD", "--", live_log_rel)
            self._run_git("reset", "HEAD", "--", index_rel)
        else:
            self._run_git("rm", "--cached", "--ignore-unmatch", "--", live_log_rel)
            self._run_git("rm", "--cached", "--ignore-unmatch", "--", index_rel)

        # 코드 변경이 있으면 quality gate를 통과한 뒤 feature commit을 만든다.
        if self._run_git("diff", "--cached", "--quiet").returncode != 0:
            if not self._run_quality_gate():
                sys.exit(1)
            msg = self.FEAT_MSG.format(phase=self._phase_name, num=step_num, name=step_name)
            r = self._run_git("commit", "-m", msg)
            if r.returncode == 0:
                print(f"  Commit: {msg}")
            else:
                print(f"  WARN: 코드 커밋 실패: {r.stderr.strip()}")

        # 마지막으로 index 같은 실행 기록을 housekeeping commit으로 남긴다. live log는 로컬 관찰용이다.
        self._run_git("add", "-A")
        if has_head:
            self._run_git("reset", "HEAD", "--", live_log_rel)
        else:
            self._run_git("rm", "--cached", "--ignore-unmatch", "--", live_log_rel)
        if self._run_git("diff", "--cached", "--quiet").returncode != 0:
            msg = self.CHORE_MSG.format(phase=self._phase_name, num=step_num)
            r = self._run_git("commit", "-m", msg)
            if r.returncode != 0:
                print(f"  WARN: housekeeping 커밋 실패: {r.stderr.strip()}")

    # --- top-level index ---

    # phases/index.json에 현재 phase의 최종 상태와 timestamp를 반영한다.
    def _update_top_index(self, status: str):
        if not self._top_index_file.exists():
            return
        top = self._read_json(self._top_index_file)
        ts = self._stamp()
        for phase in top.get("phases", []):
            if phase.get("dir") == self._phase_dir_name:
                phase["status"] = status
                ts_key = {"completed": "completed_at", "error": "failed_at", "blocked": "blocked_at"}.get(status)
                if ts_key:
                    phase[ts_key] = ts
                break
        self._write_json(self._top_index_file, top)

    # 이미 phase가 완료된 상태이면 timestamp를 다시 쓰지 않고 no-op으로 끝낸다.
    def _is_already_completed(self) -> bool:
        index = self._read_json(self._index_file)
        if not index.get("steps"):
            return False
        if any(step.get("status") != "completed" for step in index["steps"]):
            return False
        if not self._top_index_file.exists():
            return False
        top = self._read_json(self._top_index_file)
        return any(
            phase.get("dir") == self._phase_dir_name and phase.get("status") == "completed"
            for phase in top.get("phases", [])
        )

    # --- guardrails & context ---

    # AGENTS.md와 docs/*.md를 모아 각 Codex step에 전달할 프로젝트 규칙 context를 만든다.
    def _load_guardrails(self) -> str:
        sections = []
        agents_md = ROOT / "AGENTS.md"
        if agents_md.exists():
            sections.append(f"## 프로젝트 규칙 (AGENTS.md)\n\n{agents_md.read_text(encoding='utf-8')}")
        docs_dir = ROOT / "docs"
        if docs_dir.is_dir():
            for doc in sorted(docs_dir.glob("*.md")):
                sections.append(f"## {doc.stem}\n\n{doc.read_text(encoding='utf-8')}")
        return "\n\n---\n\n".join(sections) if sections else ""

    # 이미 완료된 step의 summary를 모아 다음 step이 이어받을 수 있는 짧은 context를 만든다.
    @staticmethod
    def _build_step_context(index: dict) -> str:
        lines = [
            f"- Step {s['step']} ({s['name']}): {s['summary']}"
            for s in index["steps"]
            if s["status"] == "completed" and s.get("summary")
        ]
        if not lines:
            return ""
        return "## 이전 Step 산출물\n\n" + "\n".join(lines) + "\n\n"

    # guardrail, 이전 step summary, 재시도 에러를 합쳐 Codex에게 줄 공통 지시문을 만든다.
    def _build_preamble(self, guardrails: str, step_context: str,
                        prev_error: Optional[str] = None) -> str:
        retry_section = ""
        if prev_error:
            # 재시도에서는 직전 실패 원인을 prompt 앞쪽에 넣어 같은 실패를 반복하지 않게 한다.
            retry_section = (
                "\n## ⚠ 이전 시도 실패 — 아래 에러를 반드시 참고하여 수정하라\n\n"
                f"{prev_error}\n\n---\n\n"
            )
        return (
            f"당신은 {self._project} 프로젝트의 개발자입니다. 아래 step을 수행하세요.\n\n"
            f"{guardrails}\n\n---\n\n"
            f"{step_context}{retry_section}"
            "## 작업 규칙\n\n"
            "1. 이전 step에서 작성된 코드를 확인하고 일관성을 유지하라.\n"
            "2. 이 step에 명시된 작업만 수행하라. 추가 기능이나 파일을 만들지 마라.\n"
            "3. 기존 테스트를 깨뜨리지 마라.\n"
            "4. AC(Acceptance Criteria) 검증을 직접 실행하라.\n"
            f"5. /phases/{self._phase_dir_name}/index.json의 해당 step status를 업데이트하라:\n"
            "   - AC 통과 → \"completed\" + \"summary\" 필드에 이 step의 산출물을 한 줄로 요약\n"
            f"   - {self.MAX_RETRIES}회 수정 시도 후에도 실패 → \"error\" + \"error_message\" 기록\n"
            "   - 사용자 개입이 필요한 경우 (API 키, 인증, 수동 설정 등) → \"blocked\" + \"blocked_reason\" 기록 후 즉시 중단\n"
            "6. git commit을 실행하지 마라. step별 commit은 scripts/execute.py runner가 수행한다.\n\n---\n\n"
        )

    # --- Codex 호출 ---

    # 긴 문자열을 터미널 요약에 맞게 줄인다.
    @staticmethod
    def _truncate(value: str, limit: int = 240) -> str:
        compact = " ".join(value.split())
        if len(compact) <= limit:
            return compact
        return compact[: limit - 1] + "…"

    # dict/list 안에서 특정 key의 문자열 값을 느슨하게 찾는다. Codex JSON event schema 변경에 대비한다.
    @staticmethod
    def _collect_values_for_keys(value: Any, keys: set[str], *, limit: int = 6) -> list[str]:
        found: list[str] = []

        def visit(node: Any):
            if len(found) >= limit:
                return
            if isinstance(node, dict):
                for key, child in node.items():
                    lowered = str(key).lower()
                    if lowered in keys:
                        text = StepExecutor._stringify_summary_value(child)
                        if text:
                            found.append(text)
                    else:
                        visit(child)
            elif isinstance(node, list):
                for child in node:
                    visit(child)

        visit(value)
        return found

    # JSON event 내부의 message/content 필드는 string, list, dict 어느 형태든 올 수 있으므로 요약 문자열로 접는다.
    @staticmethod
    def _stringify_summary_value(value: Any) -> str:
        if isinstance(value, str):
            return value.strip()
        if isinstance(value, list):
            parts = [StepExecutor._stringify_summary_value(item) for item in value]
            return " ".join(part for part in parts if part).strip()
        if isinstance(value, dict):
            for key in ("text", "message", "content", "summary", "value"):
                if key in value:
                    text = StepExecutor._stringify_summary_value(value[key])
                    if text:
                        return text
        return ""

    # codex exec --json line 하나에서 콘솔에 보여줄 message/command/error만 추출한다.
    @staticmethod
    def _summarize_codex_line(raw_line: str) -> dict:
        try:
            event = json.loads(raw_line)
        except json.JSONDecodeError:
            return {}

        if not isinstance(event, dict):
            return {}

        messages = StepExecutor._collect_values_for_keys(
            event, {"message", "text", "content", "summary"}
        )
        commands = StepExecutor._collect_values_for_keys(event, {"command", "cmd"})
        errors = StepExecutor._collect_values_for_keys(event, {"error", "error_message"})

        summary: dict[str, str] = {}
        if messages:
            summary["message"] = StepExecutor._truncate(messages[0])
        if commands:
            summary["command"] = StepExecutor._truncate(commands[0])
        if errors:
            summary["error"] = StepExecutor._truncate(errors[0])
        return summary

    # stderr tail은 retry prompt에 들어가므로 작은 크기로 제한한다.
    @staticmethod
    def _append_tail(lines: list[str], line: str, limit: int = 20):
        clean = line.rstrip("\n")
        if clean:
            lines.append(clean)
            del lines[:-limit]

    # step live log 경로를 만든다.
    def _live_log_path(self, step_num: int) -> Path:
        return self._phase_dir / f"step{step_num}-live.log"

    # 성공한 step의 live log를 지운다. 실패/blocked 상태의 log는 복구와 디버깅을 위해 보존한다.
    def _delete_live_log(self, step_num: int):
        live_log_path = self._live_log_path(step_num)
        try:
            live_log_path.unlink()
        except FileNotFoundError:
            return
        except OSError as exc:
            print(f"  WARN: live log cleanup failed: {exc}")

    # step markdown과 공통 preamble을 합쳐 headless Codex 실행을 호출하고 live log를 기록한다.
    def _invoke_codex(self, step: dict, preamble: str, attempt: int) -> dict:
        step_num, step_name = step["step"], step["name"]
        step_file = self._phase_dir / f"step{step_num}.md"

        if not step_file.exists():
            print(f"  ERROR: {step_file} not found")
            sys.exit(1)

        # 실행 agent가 필요한 모든 맥락을 한 prompt로 합친 뒤 sandbox/approval 설정과 함께 실행한다.
        prompt = preamble + step_file.read_text(encoding="utf-8")
        live_log_path = self._live_log_path(step_num)
        summary = CodexRunSummary(live_log_path=str(live_log_path.relative_to(ROOT)))
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
                self._root,
                prompt,
            ],
            cwd=self._root,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
        )

        def read_pipe(name: str, pipe):
            try:
                for line in iter(pipe.readline, ""):
                    events.put((name, line))
            finally:
                events.put((name, None))

        stdout_thread = threading.Thread(target=read_pipe, args=("stdout", process.stdout), daemon=True)
        stderr_thread = threading.Thread(target=read_pipe, args=("stderr", process.stderr), daemon=True)
        stdout_thread.start()
        stderr_thread.start()

        finished_streams: set[str] = set()
        deadline = started + 1800
        next_heartbeat = started + self.HEARTBEAT_INTERVAL_SEC
        timed_out = False

        with open(live_log_path, "a", encoding="utf-8") as live_log:
            live_log.write(json.dumps({
                "stream": "harness",
                "event": "start",
                "step": step_num,
                "name": step_name,
                "attempt": attempt,
                "createdAt": self._stamp(),
            }, ensure_ascii=False) + "\n")
            live_log.flush()

            while len(finished_streams) < 2:
                now = time.monotonic()
                if not timed_out and now >= deadline and process.poll() is None:
                    timed_out = True
                    process.kill()
                    message = "codex exec timed out after 1800 seconds"
                    self._append_tail(summary.stderr_tail, message)
                    live_log.write(json.dumps({
                        "stream": "harness",
                        "event": "timeout",
                        "message": message,
                    }, ensure_ascii=False) + "\n")
                    live_log.flush()

                try:
                    stream, line = events.get(timeout=0.5)
                except queue.Empty:
                    if now >= next_heartbeat:
                        elapsed = int(now - started)
                        print(f"    ... {elapsed}s elapsed; live log: {summary.live_log_path}", flush=True)
                        next_heartbeat = now + self.HEARTBEAT_INTERVAL_SEC
                    if process.poll() is not None and len(finished_streams) == 2:
                        break
                    continue

                if line is None:
                    finished_streams.add(stream)
                    continue

                if stream == "stdout":
                    live_log.write(line)
                    parsed = self._summarize_codex_line(line)
                    if parsed.get("message") and parsed["message"] != summary.last_message:
                        summary.last_message = parsed["message"]
                        print(f"    agent: {summary.last_message}", flush=True)
                    if parsed.get("command") and parsed["command"] not in summary.commands:
                        summary.commands.append(parsed["command"])
                        print(f"    command: {parsed['command']}", flush=True)
                    if parsed.get("error"):
                        self._append_tail(summary.stderr_tail, parsed["error"])
                        print(f"    error: {parsed['error']}", flush=True)
                else:
                    self._append_tail(summary.stderr_tail, line)
                    live_log.write(json.dumps({
                        "stream": "stderr",
                        "line": line.rstrip("\n"),
                    }, ensure_ascii=False) + "\n")
                live_log.flush()

        stdout_thread.join(timeout=1)
        stderr_thread.join(timeout=1)
        summary.exit_code = process.wait()
        elapsed = time.monotonic() - started

        if timed_out and summary.exit_code == 0:
            summary.exit_code = 124

        if summary.exit_code != 0:
            print(f"\n  WARN: Codex가 비정상 종료됨 (code {summary.exit_code})")
            if summary.stderr_tail:
                print(f"  stderr tail: {self._truncate(' | '.join(summary.stderr_tail), 500)}")

        # 재시도 prompt와 실행 요약에 필요한 값만 같은 runner 프로세스 안에서 반환한다.
        return {
            "step": step_num, "name": step_name,
            "attempt": attempt,
            "elapsedSec": int(elapsed),
            **summary.to_dict(),
        }

    # --- 헤더 & 검증 ---

    # 실행 시작 시 phase 이름과 옵션을 사람이 보기 쉬운 형태로 출력한다.
    def _print_header(self):
        print(f"\n{'='*60}")
        print("  Harness Step Executor")
        print(f"  Phase: {self._phase_name} | Steps: {self._total}")
        if self._auto_push:
            print("  Auto-push: enabled")
        print(f"{'='*60}")

    # 이전 실행에서 error/blocked 상태로 멈춘 step이 있으면 복구 안내 후 중단한다.
    def _check_blockers(self):
        index = self._read_json(self._index_file)
        # 뒤쪽 step부터 확인해 가장 최근에 멈춘 지점을 우선 보여준다.
        for s in reversed(index["steps"]):
            if s["status"] == "error":
                print(f"\n  ✗ Step {s['step']} ({s['name']}) failed.")
                print(f"  Error: {s.get('error_message', 'unknown')}")
                print("  Fix and reset status to 'pending' to retry.")
                sys.exit(1)
            if s["status"] == "blocked":
                print(f"\n  ⏸ Step {s['step']} ({s['name']}) blocked.")
                print(f"  Reason: {s.get('blocked_reason', 'unknown')}")
                print("  Resolve and reset status to 'pending' to retry.")
                sys.exit(2)
            if s["status"] != "pending":
                break

    # phase index에 최초 생성 시간이 없으면 현재 실행 시각으로 채운다.
    def _ensure_created_at(self):
        index = self._read_json(self._index_file)
        if "created_at" not in index:
            index["created_at"] = self._stamp()
            self._write_json(self._index_file, index)

    # --- 실행 루프 ---

    # 하위 agent가 completed로 표시한 직후 runner가 죽은 경우, 재실행 시 commit 경로를 이어 탄다.
    def _finalize_completed_step(self, step: dict):
        step_num, step_name = step["step"], step["name"]
        index = self._read_json(self._index_file)
        for item in index["steps"]:
            if item["step"] == step_num:
                item["completed_at"] = self._stamp()
                break
        self._write_json(self._index_file, index)
        self._commit_step(step_num, step_name)
        self._delete_live_log(step_num)
        print(f"  ✓ Step {step_num}: {step_name} finalized from completed status")

    # 재시도 prompt에 live log 위치와 마지막 stderr를 포함해 같은 실패를 반복하지 않게 한다.
    @staticmethod
    def _format_retry_error(message: str, output: dict) -> str:
        details = [message]
        if output.get("exitCode") not in (None, 0):
            details.append(f"Codex exit code: {output['exitCode']}")
        if output.get("liveLogPath"):
            details.append(f"Live log: {output['liveLogPath']}")
        if output.get("commands"):
            details.append("Observed commands: " + "; ".join(output["commands"][-5:]))
        if output.get("stderrTail"):
            details.append("stderr tail: " + " | ".join(output["stderrTail"][-5:]))
        return "\n".join(details)

    # 하나의 step을 Codex로 실행하고 status가 확정될 때까지 재시도한다.
    def _execute_single_step(self, step: dict, guardrails: str) -> bool:
        """단일 step 실행 (재시도 포함). 완료되면 True, 실패/차단이면 False."""
        step_num, step_name = step["step"], step["name"]
        done = sum(1 for s in self._read_json(self._index_file)["steps"] if s["status"] == "completed")
        prev_error = None

        for attempt in range(1, self.MAX_RETRIES + 1):
            # 매 시도마다 최신 index를 읽어 이전 step summary와 직전 실패 정보를 prompt에 반영한다.
            index = self._read_json(self._index_file)
            step_context = self._build_step_context(index)
            preamble = self._build_preamble(guardrails, step_context, prev_error)

            tag = f"Step {step_num}/{self._total - 1} ({done} done): {step_name}"
            if attempt > 1:
                tag += f" [retry {attempt}/{self.MAX_RETRIES}]"

            # 실제 작업은 Codex subprocess가 수행하고, 이 프로세스는 진행 표시와 결과 판정만 담당한다.
            print(f"\n  ▶ {tag}")
            output = self._invoke_codex(step, preamble, attempt)
            elapsed = output.get("elapsedSec", 0)

            # Codex가 수정한 index를 다시 읽어 completed/blocked/error 흐름 중 어디로 갈지 결정한다.
            index = self._read_json(self._index_file)
            status = next((s.get("status", "pending") for s in index["steps"] if s["step"] == step_num), "pending")
            ts = self._stamp()

            if status == "completed":
                # 성공한 step은 완료 시각을 기록하고 변경사항을 커밋한 뒤 다음 step으로 넘어간다.
                for s in index["steps"]:
                    if s["step"] == step_num:
                        s["completed_at"] = ts
                self._write_json(self._index_file, index)
                self._commit_step(step_num, step_name)
                self._delete_live_log(step_num)
                print(f"  ✓ Step {step_num}: {step_name} [{elapsed}s]")
                return True

            if status == "blocked":
                # 사용자 개입이 필요한 경우에는 phase 전체를 blocked로 표시하고 즉시 멈춘다.
                for s in index["steps"]:
                    if s["step"] == step_num:
                        s["blocked_at"] = ts
                self._write_json(self._index_file, index)
                reason = next((s.get("blocked_reason", "") for s in index["steps"] if s["step"] == step_num), "")
                print(f"  ⏸ Step {step_num}: {step_name} blocked [{elapsed}s]")
                print(f"    Reason: {reason}")
                self._update_top_index("blocked")
                sys.exit(2)

            default_error = "Step did not update status"
            if output.get("exitCode") not in (None, 0):
                default_error = f"Codex exited before updating status"
            err_msg = next(
                (s.get("error_message", default_error) for s in index["steps"] if s["step"] == step_num),
                default_error,
            )
            err_msg = self._format_retry_error(err_msg, output)

            if attempt < self.MAX_RETRIES:
                # 아직 재시도 여지가 있으면 status를 pending으로 되돌리고 실패 원인을 다음 prompt에 넘긴다.
                for s in index["steps"]:
                    if s["step"] == step_num:
                        s["status"] = "pending"
                        s.pop("error_message", None)
                self._write_json(self._index_file, index)
                prev_error = err_msg
                print(f"  ↻ Step {step_num}: retry {attempt}/{self.MAX_RETRIES} — {err_msg}")
            else:
                # 마지막 시도까지 실패하면 error 상태를 확정하고 실행 기록을 커밋한 뒤 종료한다.
                for s in index["steps"]:
                    if s["step"] == step_num:
                        s["status"] = "error"
                        s["error_message"] = f"[{self.MAX_RETRIES}회 시도 후 실패] {err_msg}"
                        s["failed_at"] = ts
                self._write_json(self._index_file, index)
                self._commit_step(step_num, step_name)
                print(f"  ✗ Step {step_num}: {step_name} failed after {self.MAX_RETRIES} attempts [{elapsed}s]")
                print(f"    Error: {err_msg}")
                self._update_top_index("error")
                sys.exit(1)

        return False

    # index에서 pending step을 순서대로 찾아 모든 step이 끝날 때까지 실행한다.
    def _execute_all_steps(self, guardrails: str):
        while True:
            index = self._read_json(self._index_file)
            pending_finalization = next(
                (
                    s for s in index["steps"]
                    if s["status"] == "completed" and "completed_at" not in s
                ),
                None,
            )
            if pending_finalization is not None:
                self._finalize_completed_step(pending_finalization)
                continue

            pending = next((s for s in index["steps"] if s["status"] == "pending"), None)
            if pending is None:
                print("\n  All steps completed!")
                return

            # step 최초 진입 시각을 기록해 이후 실행 로그를 추적하기 쉽게 한다.
            step_num = pending["step"]
            for s in index["steps"]:
                if s["step"] == step_num and "started_at" not in s:
                    s["started_at"] = self._stamp()
                    self._write_json(self._index_file, index)
                    break

            self._execute_single_step(pending, guardrails)

    # 모든 step이 끝난 뒤 phase 완료 기록, 마지막 커밋, 선택적 push를 처리한다.
    def _finalize(self):
        # phase index와 top-level index를 completed 상태로 맞춘다.
        index = self._read_json(self._index_file)
        index["completed_at"] = self._stamp()
        self._write_json(self._index_file, index)
        self._update_top_index("completed")

        # 완료 timestamp처럼 남아 있는 metadata 변경이 있으면 별도 커밋으로 정리한다.
        self._run_git("add", "-A")
        if self._run_git("diff", "--cached", "--quiet").returncode != 0:
            msg = f"chore({self._phase_name}): mark phase completed"
            r = self._run_git("commit", "-m", msg)
            if r.returncode == 0:
                print(f"  ✓ {msg}")

        # 사용자가 --push를 지정한 경우에만 원격 branch에 push한다.
        if self._auto_push:
            branch = f"feat-{self._phase_name}"
            r = self._run_git("push", "-u", "origin", branch)
            if r.returncode != 0:
                print(f"\n  ERROR: git push 실패: {r.stderr.strip()}")
                sys.exit(1)
            print(f"  ✓ Pushed to origin/{branch}")

        print(f"\n{'='*60}")
        print(f"  Phase '{self._phase_name}' completed!")
        print(f"{'='*60}")


# CLI 인자를 해석하고 StepExecutor 실행을 시작한다.
def main():
    parser = argparse.ArgumentParser(description="Harness Step Executor")
    parser.add_argument("phase_dir", help="Phase directory name (e.g. 0-mvp)")
    parser.add_argument("--push", action="store_true", help="Push branch after completion")
    args = parser.parse_args()

    StepExecutor(args.phase_dir, auto_push=args.push).run()


if __name__ == "__main__":
    main()
