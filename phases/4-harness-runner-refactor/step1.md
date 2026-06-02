# Step 1: phase-index-core

## 읽을 파일

먼저 아래 파일을 읽고 harness index 계약과 Step 0 테스트를 이해한다:

- `/AGENTS.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- `/.agents/skills/harness/SKILL.md`
- `/scripts/execute.py`
- `/scripts/test_execute.py`
- `/phases/4-harness-runner-refactor/index.json`

수정하기 전에 Step 0에서 추가된 characterization tests를 확인한다.

## 작업

`StepExecutor`에 섞여 있는 phase/top index, timestamp, guardrail loading, previous summary, validation 책임을 새 package로 분리할 기반을 만든다.

생성 또는 수정할 파일:

- `scripts/harness/__init__.py`
- `scripts/harness/errors.py`
- `scripts/harness/phase_index.py`
- `scripts/test_phase_index.py`
- 필요한 경우 `scripts/test_execute.py`

필수 interface:

- `errors.py`
  - `HarnessError(Exception)`
  - `PhaseValidationError(HarnessError)`
  - 이후 step에서 재사용할 수 있도록 `GitOperationError`, `BlockedStep`, `FailedStep`도 정의해도 된다.
- `phase_index.py`
  - `DEFAULT_MAX_ATTEMPTS = 3`
  - `DEFAULT_TIMEOUT_SEC = 1800`
  - `StepConfig` dataclass: `step`, `name`, `status`, `max_attempts`, `timeout_sec`
  - `read_json(path: Path) -> dict`
  - `write_json(path: Path, data: dict) -> None`
  - `stamp() -> str`는 기존 KST `%Y-%m-%dT%H:%M:%S%z` 형식을 유지한다.
  - `load_guardrails(root: Path) -> str`는 기존처럼 `AGENTS.md`와 sorted `docs/*.md`를 `---` 구분자로 합친다.
  - `build_step_context(index: dict) -> str`는 기존 `## 이전 Step 산출물` 형식을 유지한다.
  - `validate_phase_indexes(root: Path, phase_dir_name: str) -> None`는 top index와 phase index 정합성을 검증한다.
  - `load_step_configs(root: Path, phase_dir_name: str) -> list[StepConfig]`는 optional `max_attempts`, `timeout_sec` default를 적용하고 positive integer를 검증한다.

Validation 규칙:

- `phases/index.json`에 phase dir이 등록되어 있어야 한다.
- `phases/{phase}/index.json`의 `phase` 값은 directory name과 일치해야 한다.
- `steps[].step`은 0부터 연속이어야 한다.
- 각 `stepN.md`가 존재해야 한다.
- status는 `pending`, `completed`, `error`, `blocked`만 허용한다.
- completed step은 `summary`가 있어야 한다.
- `max_attempts`, `timeout_sec`가 있으면 positive integer여야 한다.

요구사항:

- 아직 `execute.py`를 새 module에 wire하지 않아도 된다. 이 step은 phase index core를 독립 테스트 가능한 module로 만드는 단계다.
- 기존 `StepExecutor` behavior와 충돌하지 않도록 public helper 이름은 새 package 안에 둔다.

## 인수 기준

```bash
python3 -m unittest scripts.test_execute scripts.test_quality_gate scripts.test_phase_index
npm run typecheck
npm test
npm run build
```

## 검증

1. 인수 기준 command를 실행한다.
2. Architecture checklist를 확인한다:
   - 작업이 harness index/helper layer에만 머무르는가?
   - 기존 phase 파일들이 새 validation에서 통과 가능한가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
3. 이 step에 대해 `phases/4-harness-runner-refactor/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "phase index core package added with validation, defaults, guardrail loading, and summary context tests"`를 추가한다.
   - 3회 수정 시도 후에도 실패: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- `scripts/execute.py`의 CLI 계약을 바꾸지 말 것. 이유: runner integration은 이후 step에서 처리한다.
- 기존 phase index에 `created_at`이나 `started_at`을 수동 추가하지 말 것. 이유: runner가 실행 중 기록하는 metadata다.
- optional `max_attempts`, `timeout_sec`를 기존 phase 파일에 일괄 추가하지 말 것. 이유: 기본값으로 호환되어야 한다.
- 기존 test를 깨뜨리지 말 것.
