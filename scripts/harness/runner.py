"""Harness runner orchestration."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from scripts.harness.codex_client import CodexClient, CodexRunResult
from scripts.harness.errors import BlockedStep, FailedStep, PhaseValidationError
from scripts.harness.git_ops import GitOps
from scripts.harness.phase_index import (
    DEFAULT_MAX_ATTEMPTS,
    DEFAULT_TIMEOUT_SEC,
    StepConfig,
    build_step_context,
    load_guardrails,
    load_step_configs,
    read_json,
    stamp,
    write_json,
)


@dataclass(frozen=True)
class HarnessConfig:
    root: Path
    phase_dir_name: str
    auto_push: bool


class HarnessRunner:
    """Runs harness steps and finalizes phase metadata."""

    def __init__(self, config: HarnessConfig):
        self._config = config
        self._root = Path(config.root)
        self._phases_dir = self._root / "phases"
        self._phase_dir_name = config.phase_dir_name
        self._phase_dir = self._phases_dir / self._phase_dir_name
        self._top_index_file = self._phases_dir / "index.json"
        self._index_file = self._phase_dir / "index.json"
        self._project = "project"
        self._phase_name = self._phase_dir_name
        self._total = 0
        self._step_configs: dict[int, StepConfig] = {}
        self._git_ops: Optional[GitOps] = None
        self._codex: Optional[CodexClient] = None
        self._refresh_metadata_if_available()

    def run(self) -> None:
        self._print_header()
        self._load_and_validate_phase()
        self._git_ops = GitOps(
            root_path=self._root,
            phase_name=self._phase_name,
            phase_dir_name=self._phase_dir_name,
        )
        self._codex = CodexClient(
            root_path=self._root,
            phase_dir_path=self._phase_dir,
            timestamp=stamp,
        )

        self._git_ops.ensure_clean_worktree(allowed_dirty_paths=self._dirty_recovery_paths())
        if self._is_already_completed():
            print("\n  Phase already completed; no pending runner work.")
            if self._config.auto_push:
                print("  Auto-push skipped because no work ran.")
            return

        self._check_blockers()
        self._git_ops.checkout_branch()
        guardrails = load_guardrails(self._root)
        self._ensure_created_at()
        self._execute_all_steps(guardrails)
        self._finalize()

    def _load_and_validate_phase(self) -> None:
        configs = load_step_configs(self._root, self._phase_dir_name)
        self._step_configs = {config.step: config for config in configs}
        self._refresh_metadata_if_available()

    def _dirty_recovery_paths(self) -> list[str]:
        return [
            "phases/index.json",
            f"phases/{self._phase_dir_name}/index.json",
        ]

    def _refresh_metadata_if_available(self) -> None:
        if not self._index_file.exists():
            return

        try:
            index = read_json(self._index_file)
        except Exception:
            return

        self._project = index.get("project", "project")
        self._phase_name = index.get("phase", self._phase_dir_name)
        steps = index.get("steps", [])
        self._total = len(steps) if isinstance(steps, list) else 0

    def _print_header(self) -> None:
        print(f"\n{'=' * 60}")
        print("  Harness Step Executor")
        print(f"  Phase: {self._phase_name} | Steps: {self._total}")
        if self._config.auto_push:
            print("  Auto-push: enabled")
        print(f"{'=' * 60}")

    def _update_top_index(self, status: str) -> None:
        top = read_json(self._top_index_file)
        ts = stamp()
        for phase in top.get("phases", []):
            if phase.get("dir") == self._phase_dir_name:
                phase["status"] = status
                ts_key = {"completed": "completed_at", "error": "failed_at", "blocked": "blocked_at"}.get(status)
                if ts_key:
                    phase[ts_key] = ts
                break
        write_json(self._top_index_file, top)

    def _is_already_completed(self) -> bool:
        index = read_json(self._index_file)
        if not index.get("steps"):
            return False
        if any(step.get("status") != "completed" for step in index["steps"]):
            return False

        top = read_json(self._top_index_file)
        return any(
            phase.get("dir") == self._phase_dir_name and phase.get("status") == "completed"
            for phase in top.get("phases", [])
        )

    def _check_blockers(self) -> None:
        index = read_json(self._index_file)
        for step in reversed(index["steps"]):
            if step["status"] == "error":
                message = (
                    f"Step {step['step']} ({step['name']}) failed. "
                    f"Error: {step.get('error_message', 'unknown')}. "
                    "Fix and reset status to 'pending' to retry."
                )
                raise FailedStep(message)
            if step["status"] == "blocked":
                message = (
                    f"Step {step['step']} ({step['name']}) blocked. "
                    f"Reason: {step.get('blocked_reason', 'unknown')}. "
                    "Resolve and reset status to 'pending' to retry."
                )
                raise BlockedStep(message)
            if step["status"] != "pending":
                break

    def _ensure_created_at(self) -> None:
        index = read_json(self._index_file)
        if "created_at" not in index:
            index["created_at"] = stamp()
            write_json(self._index_file, index)

    def _build_preamble(
        self,
        guardrails: str,
        step_context: str,
        prev_error: Optional[str],
        max_attempts: int,
    ) -> str:
        retry_section = ""
        if prev_error:
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
            f"   - {max_attempts}회 수정 시도 후에도 실패 → \"error\" + \"error_message\" 기록\n"
            "   - 사용자 개입이 필요한 경우 (API 키, 인증, 수동 설정 등) → \"blocked\" + \"blocked_reason\" 기록 후 즉시 중단\n"
            "6. git commit을 실행하지 마라. step별 commit은 scripts/execute.py runner가 수행한다.\n\n---\n\n"
        )

    def _build_prompt(
        self,
        step: StepConfig,
        guardrails: str,
        prev_error: Optional[str],
    ) -> str:
        step_file = self._phase_dir / f"step{step.step}.md"
        if not step_file.exists():
            raise PhaseValidationError(f"{step_file} not found")

        index = read_json(self._index_file)
        step_context = build_step_context(index)
        preamble = self._build_preamble(guardrails, step_context, prev_error, step.max_attempts)
        return preamble + step_file.read_text(encoding="utf-8")

    def _step_config_from_index_step(self, step: dict) -> StepConfig:
        return StepConfig(
            step=step["step"],
            name=step["name"],
            status=step.get("status", "pending"),
            max_attempts=step.get("max_attempts", DEFAULT_MAX_ATTEMPTS),
            timeout_sec=step.get("timeout_sec", DEFAULT_TIMEOUT_SEC),
        )

    def _finalize_completed_step(self, step: StepConfig) -> None:
        index = read_json(self._index_file)
        for item in index["steps"]:
            if item["step"] == step.step:
                item["completed_at"] = stamp()
                break
        write_json(self._index_file, index)
        self._require_git_ops().commit_step(step.step, step.name)
        self._require_codex().delete_live_log(step.step)
        print(f"  ✓ Step {step.step}: {step.name} finalized from completed status")

    def _execute_all_steps(self, guardrails: str) -> None:
        while True:
            index = read_json(self._index_file)
            pending_finalization = next(
                (
                    step
                    for step in index["steps"]
                    if step["status"] == "completed" and "completed_at" not in step
                ),
                None,
            )
            if pending_finalization is not None:
                self._finalize_completed_step(self._step_config_from_index_step(pending_finalization))
                continue

            pending = next((step for step in index["steps"] if step["status"] == "pending"), None)
            if pending is None:
                print("\n  All steps completed!")
                return

            for step in index["steps"]:
                if step["step"] == pending["step"] and "started_at" not in step:
                    step["started_at"] = stamp()
                    write_json(self._index_file, index)
                    break

            self._execute_single_step(self._step_config_from_index_step(pending), guardrails)

    def _execute_single_step(self, step: StepConfig, guardrails: str) -> None:
        done = sum(1 for item in read_json(self._index_file)["steps"] if item["status"] == "completed")
        prev_error: Optional[str] = None

        for attempt in range(1, step.max_attempts + 1):
            prompt = self._build_prompt(step, guardrails, prev_error)
            tag = f"Step {step.step}/{self._total - 1} ({done} done): {step.name}"
            if attempt > 1:
                tag += f" [retry {attempt}/{step.max_attempts}]"

            print(f"\n  ▶ {tag}")
            result = self._require_codex().invoke(step, prompt, attempt)

            index = read_json(self._index_file)
            current = next((item for item in index["steps"] if item["step"] == step.step), None)
            status = current.get("status", "pending") if current else "pending"
            ts = stamp()

            if status == "completed":
                for item in index["steps"]:
                    if item["step"] == step.step:
                        item["completed_at"] = ts
                        break
                write_json(self._index_file, index)
                self._require_git_ops().commit_step(step.step, step.name)
                self._require_codex().delete_live_log(step.step)
                print(f"  ✓ Step {step.step}: {step.name} [{result.elapsed_sec}s]")
                return

            if status == "blocked":
                for item in index["steps"]:
                    if item["step"] == step.step:
                        item["blocked_at"] = ts
                        break
                write_json(self._index_file, index)
                reason = current.get("blocked_reason", "") if current else ""
                self._update_top_index("blocked")
                print(f"  ⏸ Step {step.step}: {step.name} blocked [{result.elapsed_sec}s]")
                print(f"    Reason: {reason}")
                raise BlockedStep(f"Step {step.step} ({step.name}) blocked: {reason or 'unknown'}")

            err_msg = self._format_step_error(current, result)

            if attempt < step.max_attempts:
                for item in index["steps"]:
                    if item["step"] == step.step:
                        item["status"] = "pending"
                        item.pop("error_message", None)
                        break
                write_json(self._index_file, index)
                prev_error = err_msg
                print(f"  ↻ Step {step.step}: retry {attempt}/{step.max_attempts} — {err_msg}")
                continue

            for item in index["steps"]:
                if item["step"] == step.step:
                    item["status"] = "error"
                    item["error_message"] = f"[{step.max_attempts}회 시도 후 실패] {err_msg}"
                    item["failed_at"] = ts
                    break
            write_json(self._index_file, index)
            self._update_top_index("error")
            self._require_git_ops().commit_step(step.step, step.name)
            print(f"  ✗ Step {step.step}: {step.name} failed after {step.max_attempts} attempts [{result.elapsed_sec}s]")
            print(f"    Error: {err_msg}")
            raise FailedStep(f"Step {step.step} ({step.name}) failed after {step.max_attempts} attempts: {err_msg}")

    def _format_step_error(self, step: Optional[dict], result: CodexRunResult) -> str:
        default_error = "Step did not update status"
        if result.exit_code != 0:
            default_error = "Codex exited before updating status"
        message = step.get("error_message", default_error) if step else default_error
        return self._require_codex().format_retry_error(message, result)

    def _finalize(self) -> None:
        index = read_json(self._index_file)
        index["completed_at"] = stamp()
        write_json(self._index_file, index)
        self._update_top_index("completed")

        self._require_git_ops().commit_phase_completed()
        if self._config.auto_push:
            self._require_git_ops().push_phase_branch()

        print(f"\n{'=' * 60}")
        print(f"  Phase '{self._phase_name}' completed!")
        print(f"{'=' * 60}")

    def _require_git_ops(self) -> GitOps:
        if self._git_ops is None:
            raise RuntimeError("git ops not initialized")
        return self._git_ops

    def _require_codex(self) -> CodexClient:
        if self._codex is None:
            raise RuntimeError("codex client not initialized")
        return self._codex
