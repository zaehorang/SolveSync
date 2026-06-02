# Step 0: characterization-tests

## 읽을 파일

먼저 아래 파일을 읽고 현재 harness runner behavior와 리팩터링 목표를 이해한다:

- `/AGENTS.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- `/.agents/skills/harness/SKILL.md`
- `/scripts/execute.py`
- `/scripts/test_execute.py`
- `/scripts/quality_gate.py`
- `/scripts/test_quality_gate.py`
- `/phases/4-harness-runner-refactor/index.json`

수정하기 전에 현재 `StepExecutor`가 제공하는 동작을 주의 깊게 읽는다. 이 step은 behavior-preserving 리팩터링의 안전망을 만드는 단계다.

## 작업

현재 구현이 이미 제공하는 동작을 characterization test로 고정한다. 새 behavior를 요구하는 실패 테스트는 만들지 않는다.

수정할 파일:

- `scripts/test_execute.py`
- 필요한 경우 `scripts/test_quality_gate.py`

테스트로 고정할 동작:

- `AGENTS.md`와 `docs/*.md` guardrail context가 prompt 재료로 로드된다.
- completed step summary가 `## 이전 Step 산출물` 섹션으로 다음 prompt에 포함된다.
- retry error formatting은 previous error, live log path, observed commands, stderr tail을 포함한다.
- completed finalization recovery는 completed이지만 `completed_at`이 없는 step을 재실행하지 않고 finalize한다.
- success live log는 삭제되고 failed live log는 보존된다.
- feature/code commit이 필요한 경우에만 quality gate를 호출한다.
- metadata-only commit에는 quality gate를 호출하지 않는다.

요구사항:

- 현재 `execute.py`를 리팩터링하지 않는다.
- 현재 동작에서 통과하지 않는 미래 behavior 테스트를 추가하지 않는다. dirty worktree preflight, hard fail, optional timeout/retry validation은 이후 step에서 구현과 함께 테스트한다.
- 테스트는 `subprocess`, git command, `Popen`을 mock/stub해 실제 branch/commit/Codex 실행을 만들지 않는다.

## 인수 기준

```bash
python3 -m unittest scripts.test_execute scripts.test_quality_gate
npm run typecheck
npm test
npm run build
```

## 검증

1. 인수 기준 command를 실행한다.
2. Architecture checklist를 확인한다:
   - 작업이 harness runner 테스트 표면만 다루는가?
   - `ADR.md`의 TypeScript/Vite/npm/Vitest 제품 결정과 충돌하지 않는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
3. 이 step에 대해 `phases/4-harness-runner-refactor/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "characterization tests added for existing harness runner prompt, log, retry, finalization, and quality gate timing behavior"`를 추가한다.
   - 3회 수정 시도 후에도 실패: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- `scripts/execute.py`를 리팩터링하지 말 것. 이유: 이 step은 기존 behavior를 먼저 고정하는 안전망 단계다.
- 실패하는 미래 behavior 테스트를 추가하지 말 것. 이유: 이후 step을 독립 실행 가능하게 유지해야 한다.
- 실제 git commit, branch checkout, push, Codex subprocess를 실행하는 테스트를 만들지 말 것. 이유: 하네스 테스트는 mock/stub 기반이어야 한다.
- 기존 test를 깨뜨리지 말 것.
