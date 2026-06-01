"""Phase index helpers for the Codex harness."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum
from pathlib import Path

from scripts.harness.errors import PhaseValidationError

DEFAULT_MAX_ATTEMPTS = 3
DEFAULT_TIMEOUT_SEC = 1800

_KST = timezone(timedelta(hours=9))


class StepStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    ERROR = "error"
    BLOCKED = "blocked"

    @classmethod
    def values(cls) -> set[str]:
        return {status.value for status in cls}


_ALLOWED_STATUSES = StepStatus.values()


@dataclass(frozen=True)
class StepConfig:
    step: int
    name: str
    status: str
    max_attempts: int
    timeout_sec: int


def read_json(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise PhaseValidationError(f"{path} must contain a JSON object")
    return data


def write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def update_step(index_path: Path, step_num: int, **patch: object) -> dict:
    index = read_json(index_path)
    step = _find_step(index, step_num, index_path)
    step.update(patch)
    write_json(index_path, index)
    return index


def clear_step_fields(index_path: Path, step_num: int, *fields: str) -> dict:
    index = read_json(index_path)
    step = _find_step(index, step_num, index_path)
    for field in fields:
        step.pop(field, None)
    write_json(index_path, index)
    return index


def stamp() -> str:
    return datetime.now(_KST).strftime("%Y-%m-%dT%H:%M:%S%z")


def load_guardrails(root: Path) -> str:
    sections = []
    agents_md = root / "AGENTS.md"
    if agents_md.exists():
        sections.append(f"## 프로젝트 규칙 (AGENTS.md)\n\n{agents_md.read_text(encoding='utf-8')}")

    docs_dir = root / "docs"
    if docs_dir.is_dir():
        for doc in sorted(docs_dir.glob("*.md")):
            sections.append(f"## {doc.stem}\n\n{doc.read_text(encoding='utf-8')}")

    return "\n\n---\n\n".join(sections) if sections else ""


def build_step_context(index: dict) -> str:
    lines = [
        f"- Step {step['step']} ({step['name']}): {step['summary']}"
        for step in index["steps"]
        if step["status"] == StepStatus.COMPLETED.value and step.get("summary")
    ]
    if not lines:
        return ""
    return "## 이전 Step 산출물\n\n" + "\n".join(lines) + "\n\n"


def validate_phase_indexes(root: Path, phase_dir_name: str) -> None:
    phases_dir = root / "phases"
    phase_dir = phases_dir / phase_dir_name
    top_index_path = phases_dir / "index.json"
    phase_index_path = phase_dir / "index.json"

    if not top_index_path.exists():
        raise PhaseValidationError(f"{top_index_path} not found")
    if not phase_dir.is_dir():
        raise PhaseValidationError(f"{phase_dir} not found")
    if not phase_index_path.exists():
        raise PhaseValidationError(f"{phase_index_path} not found")

    top_index = read_json(top_index_path)
    phase_index = read_json(phase_index_path)

    _validate_top_index(top_index, phase_dir_name)
    _validate_phase_index(phase_index, phase_dir_name, phase_dir)


def load_step_configs(root: Path, phase_dir_name: str) -> list[StepConfig]:
    validate_phase_indexes(root, phase_dir_name)

    phase_index = read_json(root / "phases" / phase_dir_name / "index.json")
    configs = []
    for step in phase_index["steps"]:
        configs.append(
            StepConfig(
                step=step["step"],
                name=step["name"],
                status=step["status"],
                max_attempts=step.get("max_attempts", DEFAULT_MAX_ATTEMPTS),
                timeout_sec=step.get("timeout_sec", DEFAULT_TIMEOUT_SEC),
            )
        )
    return configs


def _validate_top_index(index: dict, phase_dir_name: str) -> None:
    phases = index.get("phases")
    if not isinstance(phases, list):
        raise PhaseValidationError("phases/index.json must contain a phases list")

    if not any(isinstance(phase, dict) and phase.get("dir") == phase_dir_name for phase in phases):
        raise PhaseValidationError(f"phase '{phase_dir_name}' is not registered in phases/index.json")


def _validate_phase_index(index: dict, phase_dir_name: str, phase_dir: Path) -> None:
    if index.get("phase") != phase_dir_name:
        raise PhaseValidationError(f"{phase_dir / 'index.json'} phase must be '{phase_dir_name}'")

    steps = index.get("steps")
    if not isinstance(steps, list):
        raise PhaseValidationError(f"{phase_dir / 'index.json'} must contain a steps list")

    for expected, step in enumerate(steps):
        if not isinstance(step, dict):
            raise PhaseValidationError(f"steps[{expected}] must be an object")

        if step.get("step") != expected or isinstance(step.get("step"), bool):
            raise PhaseValidationError("steps[].step must start at 0 and be consecutive")

        step_file = phase_dir / f"step{expected}.md"
        if not step_file.exists():
            raise PhaseValidationError(f"{step_file} not found")

        name = step.get("name")
        if not isinstance(name, str) or not name.strip():
            raise PhaseValidationError(f"step {expected} must have a name")

        status = step.get("status")
        if status not in _ALLOWED_STATUSES:
            raise PhaseValidationError(
                f"step {expected} status must be one of {', '.join(sorted(_ALLOWED_STATUSES))}"
            )

        if status == StepStatus.COMPLETED.value:
            summary = step.get("summary")
            if not isinstance(summary, str) or not summary.strip():
                raise PhaseValidationError(f"completed step {expected} must have a summary")

        _validate_optional_positive_int(step, "max_attempts", expected)
        _validate_optional_positive_int(step, "timeout_sec", expected)


def _validate_optional_positive_int(step: dict, key: str, step_num: int) -> None:
    if key not in step:
        return

    value = step[key]
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise PhaseValidationError(f"step {step_num} {key} must be a positive integer")


def _find_step(index: dict, step_num: int, index_path: Path) -> dict:
    for step in index.get("steps", []):
        if isinstance(step, dict) and step.get("step") == step_num:
            return step
    raise PhaseValidationError(f"step {step_num} not found in {index_path}")
