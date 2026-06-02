# Step 5: harness-skill-docs

## 읽을 파일

먼저 아래 파일을 읽고 새 runner 계약과 agent-facing 문서를 이해한다:

- `/AGENTS.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- `/.agents/skills/harness/SKILL.md`
- `/scripts/execute.py`
- `/scripts/harness/runner.py`
- `/scripts/harness/phase_index.py`
- `/scripts/harness/git_ops.py`
- `/scripts/harness/codex_client.py`
- `/phases/4-harness-runner-refactor/index.json`

수정하기 전에 Step 4에서 통합된 runner behavior와 tests를 확인한다.

## 작업

`.agents/skills/harness/SKILL.md`를 새 runner 계약에 맞게 갱신한다.

수정할 파일:

- `.agents/skills/harness/SKILL.md`

문서에 반영할 내용:

- `phases/{task-name}/index.json` step entry optional fields:
  - `max_attempts`: runner retry 횟수 override. 없으면 기본 3.
  - `timeout_sec`: Codex execution timeout override. 없으면 기본 1800초.
  - 일반 step에는 default를 쓰고, 무거운 validation step처럼 필요한 경우에만 명시한다.
- step template의 “3회 수정 시도 후에도 실패” 문구를 runner retry 설명으로 교체한다.
  - 하위 Codex agent가 자체적으로 3회 수정한다는 의미를 제거한다.
  - agent는 현재 시도에서 AC를 실행하고, 성공/실패/blocked status와 summary/error/reason을 정확히 기록하도록 안내한다.
- 실행 설명:
  - runner는 dirty worktree면 시작하지 않는다.
  - runner가 phase/top index 정합성을 시작 시 검증한다.
  - 실패한 step은 `max_attempts`까지 이전 error message와 live log detail을 포함해 재시도한다.
  - code change와 metadata commit은 분리된다.
  - commit 실패는 hard fail이다.
  - quality gate는 feature/code commit 직전에만 실행된다. metadata-only commit 전에는 실행하지 않는다.
- prompt/context 계약:
  - `AGENTS.md`와 `docs/*.md` guardrail 주입.
  - completed step summary를 이후 step prompt에 전달.
  - retry prompt에 previous error, live log path, observed commands, stderr tail 전달.
- 복구 설명:
  - error/blocked step reset 방법 유지.
  - runner kill 또는 비정상 중단 시 phase index, live log, git status를 확인하고 runner 재실행 경로를 탄다.

요구사항:

- 제품/아키텍처 세부 규칙을 `SKILL.md`에 장황하게 복제하지 않는다. AGENTS.md 방침처럼 source of truth는 docs에 위임한다.
- 기존 harness workflow의 단계 구조(A 탐색, B 논의, C Step 설계, D 파일 생성, E 실행)는 유지한다.

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
   - 문서가 실제 runner behavior와 일치하는가?
   - `SKILL.md`가 제품 source of truth 내용을 장황하게 복제하지 않는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
3. 이 step에 대해 `phases/4-harness-runner-refactor/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "harness skill documentation updated for modular runner, dirty preflight, step retry/timeout options, prompt context, and quality gate timing"`를 추가한다.
   - 3회 수정 시도 후에도 실패: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- 제품 동작 세부 규칙을 `SKILL.md`에 새로 복제하지 말 것. 이유: 제품 source of truth는 `docs/`다.
- runner 실제 behavior와 다른 문구를 남기지 말 것. 이유: 이후 phase 작성 agent가 잘못된 계약을 따르게 된다.
- README를 수정하지 말 것. 이유: 사용자가 README 변경을 요청하지 않았다.
- 기존 test를 깨뜨리지 말 것.
