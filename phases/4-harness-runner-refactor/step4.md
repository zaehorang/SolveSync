# Step 4: runner-integration

## 읽을 파일

먼저 아래 파일을 읽고 새 modules와 기존 runner flow를 이해한다:

- `/AGENTS.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- `/.agents/skills/harness/SKILL.md`
- `/scripts/execute.py`
- `/scripts/test_execute.py`
- `/scripts/harness/errors.py`
- `/scripts/harness/phase_index.py`
- `/scripts/harness/codex_client.py`
- `/scripts/harness/git_ops.py`
- `/scripts/test_phase_index.py`
- `/scripts/test_codex_client.py`
- `/scripts/test_git_ops.py`
- `/phases/4-harness-runner-refactor/index.json`

수정하기 전에 Step 0-3에서 추가된 tests와 modules를 확인한다.

## 작업

새 modules를 통합해 `HarnessRunner`를 만들고 `scripts/execute.py`를 CLI entrypoint로 축소한다. `StepExecutor`는 제거한다.

생성 또는 수정할 파일:

- `scripts/harness/runner.py`
- `scripts/execute.py`
- `scripts/test_runner.py`
- `scripts/test_execute.py`
- 필요한 경우 `scripts/harness/__init__.py`
- 필요한 경우 `scripts/harness/phase_index.py`, `scripts/harness/codex_client.py`, `scripts/harness/git_ops.py`

필수 interface:

- `HarnessConfig` dataclass:
  - `root: Path`
  - `phase_dir_name: str`
  - `auto_push: bool`
- `HarnessRunner`:
  - `__init__(config: HarnessConfig)`
  - `run() -> None`
- `execute.py`:
  - `ROOT = Path(__file__).resolve().parent.parent`
  - CLI args `phase_dir`, `--push` 유지
  - `HarnessRunner(HarnessConfig(ROOT, args.phase_dir, args.push)).run()`
  - `main()`에서 typed exceptions를 exit code로 변환

Runner flow:

1. print header.
2. phase/top index validation.
3. dirty worktree preflight.
4. already completed이면 message 출력 후 return.
5. branch checkout/create.
6. guardrail context load.
7. phase `created_at` ensure.
8. completed-without-`completed_at` step finalization recovery.
9. first pending step 실행.
10. step 시작 시 `started_at` 기록.
11. step별 `max_attempts`, `timeout_sec` 적용.
12. prompt 구성:
    - guardrails
    - previous step summaries
    - previous retry error details
    - 작업 규칙
    - step markdown body
13. Codex 실행.
14. index status 판정:
    - completed: `completed_at` 기록, commit step, live log 삭제.
    - blocked: `blocked_at` 기록, top index blocked, live log 보존, exit code 2 경로.
    - pending/error/no status update: retry or final error.
15. all steps complete이면 phase `completed_at`, top index completed, final metadata commit, optional push.

Behavior preservation:

- CLI contract와 branch naming을 유지한다.
- `AGENTS.md`, `docs/*.md`, completed summaries, retry detail prompt 전달을 유지한다.
- success live log 삭제, failed/blocked live log 보존을 유지한다.
- code commit과 metadata commit 분리를 유지한다.
- quality gate timing은 feature/code commit 직전으로 유지한다.

Behavior changes from safety plan:

- dirty worktree면 runner 시작을 중단한다.
- commit failure와 quality gate failure는 hard fail한다.
- optional `max_attempts`, `timeout_sec`를 지원한다.
- phase index validation failure는 runner 시작 단계에서 hard fail한다.

Test migration:

- `scripts/test_execute.py`는 CLI/entrypoint integration 중심으로 축소한다.
- 기존 `StepExecutor` internals를 직접 호출하던 tests는 새 module tests로 이동하거나 새 runner tests로 갱신한다.
- `StepExecutor` compatibility wrapper는 남기지 않는다.

## 인수 기준

```bash
python3 -m unittest discover -s scripts -p 'test_*.py'
npm run typecheck
npm test
npm run build
```

## 검증

1. 인수 기준 command를 실행한다.
2. Architecture checklist를 확인한다:
   - `scripts/execute.py` CLI 계약이 유지되는가?
   - prompt/context/log/retry/commit behavior가 characterization tests로 보존되는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
3. 이 step에 대해 `phases/4-harness-runner-refactor/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "HarnessRunner integrated, execute.py reduced to CLI, StepExecutor removed, and runner behavior covered by module tests"`를 추가한다.
   - 3회 수정 시도 후에도 실패: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- `StepExecutor` compatibility wrapper를 남기지 말 것. 이유: 내부 API 경계를 명확히 하기 위해 제거하기로 했다.
- `python3 scripts/execute.py <phase-dir> [--push]` CLI 계약을 바꾸지 말 것. 이유: 기존 harness workflow와 phase files가 이 계약에 의존한다.
- 실행 중인 runner가 중단됐다고 step 파일을 따라 수동 구현을 이어가지 말 것. 이유: harness 복구 경로는 runner 재실행이다.
- 기존 test를 깨뜨리지 말 것.
