# Step 6: integration-validation

## 읽을 파일

먼저 아래 파일을 읽고 전체 리팩터링 결과와 문서 계약을 검증한다:

- `/AGENTS.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- `/.agents/skills/harness/SKILL.md`
- `/scripts/execute.py`
- `/scripts/quality_gate.py`
- `/scripts/harness/runner.py`
- `/scripts/harness/phase_index.py`
- `/scripts/harness/git_ops.py`
- `/scripts/harness/codex_client.py`
- `/scripts/harness/errors.py`
- `/scripts/test_execute.py`
- `/scripts/test_runner.py`
- `/scripts/test_phase_index.py`
- `/scripts/test_git_ops.py`
- `/scripts/test_codex_client.py`
- `/phases/harness-runner-refactor/index.json`

수정하기 전에 Step 0-5의 summaries를 확인하고 실제 code와 docs가 일치하는지 검증한다.

## 작업

하네스 리팩터링 전체를 검증하고 필요한 최소 수정만 수행한다.

검증할 내용:

- `scripts/execute.py`는 CLI entrypoint만 담당하고 `StepExecutor` class를 남기지 않는다.
- `python3 scripts/execute.py <phase-dir> [--push]` CLI contract가 유지된다.
- `scripts/harness/` package가 책임별로 분리되어 있다.
- 기존 prompt/context 계약이 유지된다:
  - `AGENTS.md`와 `docs/*.md` guardrail 주입.
  - completed step summary 전달.
  - retry prompt에 previous error, live log path, observed commands, stderr tail 포함.
- live log 정책이 유지된다:
  - success 삭제.
  - failed/blocked 보존.
- quality gate timing이 유지된다:
  - feature/code commit 직전에만 실행.
  - metadata-only commit 전에는 미실행.
- safety changes가 반영되어 있다:
  - dirty worktree preflight.
  - commit/quality gate failure hard fail.
  - optional `max_attempts`, `timeout_sec`.
  - phase/top index validation.
- `.agents/skills/harness/SKILL.md`가 실제 runner behavior와 일치한다.

필요한 수정:

- 검증 중 발견한 mismatch만 최소 수정한다.
- 새 기능이나 hook/TDD guard 개편을 추가하지 않는다.

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
   - runner 리팩터링이 제품 runtime 구조를 건드리지 않았는가?
   - `ADR.md`의 stack decision 안에 머무르는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
3. 이 step에 대해 `phases/harness-runner-refactor/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "harness runner refactor validated across unittest, typecheck, vitest, build, skill docs, and preserved runner contracts"`를 추가한다.
   - 3회 수정 시도 후에도 실패: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- hook/TDD guard 개편을 추가하지 말 것. 이유: 후속 phase 범위로 분리했다.
- Codex event fixture contract test suite를 새로 도입하지 말 것. 이유: 이번 phase는 runner module split과 safety changes에 집중한다.
- README를 수정하지 말 것. 이유: 사용자가 README 변경을 요청하지 않았다.
- 기존 test를 깨뜨리지 말 것.
