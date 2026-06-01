# Step 2: codex-client-module

## 읽을 파일

먼저 아래 파일을 읽고 현재 Codex subprocess, live log, event parsing 동작을 이해한다:

- `/AGENTS.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- `/scripts/execute.py`
- `/scripts/test_execute.py`
- `/scripts/harness/errors.py`
- `/scripts/harness/phase_index.py`
- `/scripts/test_phase_index.py`
- `/phases/harness-runner-refactor/index.json`

수정하기 전에 Step 0과 Step 1에서 추가된 tests와 phase index core를 확인한다.

## 작업

`StepExecutor`에 있는 Codex 실행, stdout/stderr event parsing, live log, timeout, heartbeat 책임을 `scripts/harness/codex_client.py`로 분리한다.

생성 또는 수정할 파일:

- `scripts/harness/codex_client.py`
- `scripts/test_codex_client.py`
- 필요한 경우 `scripts/harness/errors.py`
- 필요한 경우 `scripts/test_execute.py`

필수 interface:

- `CodexRunResult` dataclass:
  - `exit_code: int`
  - `live_log_path: str`
  - `last_message: str`
  - `commands: list[str]`
  - `stderr_tail: list[str]`
  - `elapsed_sec: int`
- `CodexClient` class 또는 동등한 함수 기반 API:
  - root path, phase dir path, timestamp callable을 주입받을 수 있어야 한다.
  - `invoke(step: StepConfig, prompt: str, attempt: int) -> CodexRunResult`
  - `delete_live_log(step_num: int) -> None`
  - `format_retry_error(message: str, result: CodexRunResult) -> str`
- Event parsing helpers:
  - 기존 `_truncate`, `_collect_values_for_keys`, `_stringify_summary_value`, `_summarize_codex_line`, stderr tail 제한 동작을 보존한다.

Behavior requirements:

- `codex exec --json --sandbox danger-full-access -c approval_policy="never" --cd <root> <prompt>` invocation shape를 유지한다.
- default heartbeat interval은 60초를 유지한다.
- timeout은 caller가 전달한 `timeout_sec`를 사용한다. 기본 1800초 적용은 `phase_index.py`/runner 쪽 책임이다.
- live log path는 `phases/{phase}/stepN-live.log` 형식을 유지한다.
- live log start event에는 기존처럼 step, name, attempt, createdAt을 기록한다.
- stdout raw JSON line은 그대로 live log에 남긴다.
- stderr line은 JSON wrapper로 live log에 남긴다.
- timeout 시 process를 kill하고 result exit code가 0으로 보이면 124로 보정한다.

요구사항:

- 아직 `execute.py` 전체를 새 `CodexClient`에 wire하지 않아도 된다. 이후 runner integration에서 연결한다.
- tests는 `subprocess.Popen`을 fake로 대체해 실제 Codex를 실행하지 않는다.

## 인수 기준

```bash
python3 -m unittest scripts.test_execute scripts.test_quality_gate scripts.test_phase_index scripts.test_codex_client
npm run typecheck
npm test
npm run build
```

## 검증

1. 인수 기준 command를 실행한다.
2. Architecture checklist를 확인한다:
   - 작업이 Codex subprocess/logging layer에만 머무르는가?
   - 기존 live log와 retry prompt 계약이 유지되는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
3. 이 step에 대해 `phases/harness-runner-refactor/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "codex client module added for exec invocation, event parsing, timeout, heartbeat, live log, and retry error formatting"`를 추가한다.
   - 3회 수정 시도 후에도 실패: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- 실제 `codex exec`를 실행하는 테스트를 만들지 말 것. 이유: 하네스 단위 테스트는 deterministic해야 한다.
- live log 성공 삭제 정책을 이 module 밖으로 잃어버리지 말 것. 이유: 실패/blocked 복구 흐름의 핵심 계약이다.
- Codex sandbox/approval invocation shape를 임의로 바꾸지 말 것. 이유: 이번 step은 behavior-preserving extraction이다.
- 기존 test를 깨뜨리지 말 것.
