# Step 3: git-ops-quality-gate

## 읽을 파일

먼저 아래 파일을 읽고 현재 git commit 분리와 quality gate timing을 이해한다:

- `/AGENTS.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- `/scripts/execute.py`
- `/scripts/quality_gate.py`
- `/scripts/test_quality_gate.py`
- `/scripts/harness/errors.py`
- `/scripts/harness/phase_index.py`
- `/scripts/harness/codex_client.py`
- `/phases/4-harness-runner-refactor/index.json`

수정하기 전에 Step 0-2에서 추가된 tests와 modules를 확인한다.

## 작업

git operation, dirty worktree preflight, feature/metadata commit 분리, quality gate 호출을 `scripts/harness/git_ops.py`로 분리하고 `quality_gate.py`에 Python unittest 실행을 추가한다.

생성 또는 수정할 파일:

- `scripts/harness/git_ops.py`
- `scripts/test_git_ops.py`
- `scripts/quality_gate.py`
- `scripts/test_quality_gate.py`
- 필요한 경우 `scripts/harness/errors.py`
- 필요한 경우 `scripts/test_execute.py`

필수 interface:

- `GitOps` class 또는 동등한 함수 기반 API:
  - root path, phase name, phase dir name을 주입받는다.
  - `ensure_clean_worktree() -> None`
  - `checkout_branch() -> None`
  - `commit_step(step_num: int, step_name: str) -> None`
  - `commit_phase_completed() -> None`
  - `push(auto_branch_name: str) -> None` 또는 `push_phase_branch() -> None`
  - `run_quality_gate() -> None`
- `GitOperationError(HarnessError)`를 사용해 git/quality gate 실패를 hard fail로 표현한다.

Behavior requirements:

- dirty worktree preflight:
  - `git status --porcelain` 결과가 비어 있지 않으면 파일 목록을 포함한 `GitOperationError`를 raise한다.
  - override option은 만들지 않는다.
- branch checkout:
  - 기존처럼 `feat-{phase}` branch를 사용한다.
  - 현재 branch가 target이면 no-op.
  - target branch가 있으면 checkout, 없으면 `checkout -b`.
- commit split:
  - feature/code commit과 metadata commit 분리 정책을 유지한다.
  - feature commit에서는 `phases/{phase}/index.json`을 제외한다.
  - metadata commit에는 phase/top index metadata 변경을 포함한다.
  - live log는 이미 `.gitignore`에 있으므로 ignored file 전제에 맞춰 반복적인 live log reset 의존을 줄인다.
  - commit할 staged 변경이 없으면 해당 commit은 no-op.
- quality gate timing:
  - code 변경이 있어 feature commit이 필요할 때, feature commit 직전에만 `scripts/quality_gate.py`를 실행한다.
  - metadata-only commit 전에는 quality gate를 실행하지 않는다.
  - final phase completed metadata commit 전에도 quality gate를 실행하지 않는다.
  - quality gate 실패 시 commit하지 않고 `GitOperationError`를 raise한다.
- commit 실패 handling:
  - feature, housekeeping, final metadata commit 실패 모두 warning이 아니라 `GitOperationError`로 처리한다.

`quality_gate.py` requirements:

- 기존 node command order `typecheck`, `lint`, `test`, `build`를 유지한다.
- `scripts/test_*.py`가 있으면 `python3 -m unittest discover -s scripts -p 'test_*.py'`를 command list에 포함한다.
- child command 실행 시 `SOLVESYNC_QUALITY_GATE_RUNNING=1` env를 넘긴다.
- env가 이미 `SOLVESYNC_QUALITY_GATE_RUNNING=1`이면 Python unittest command를 다시 추가하지 않는다.
- pytest가 있으면 실행하는 기존 동작은 제거하거나 유지해도 되지만, unittest가 harness script tests의 source of truth가 되어야 한다. 중복 실행으로 느려지면 pytest auto-detection보다 unittest를 우선한다.

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
   - 작업이 harness git/quality gate layer에만 머무르는가?
   - quality gate 실행 시기가 기존 feature commit 직전 계약을 유지하는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
3. 이 step에 대해 `phases/4-harness-runner-refactor/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "git ops module added with dirty preflight, hard-fail commits, feature/metadata split, and unittest-backed quality gate"`를 추가한다.
   - 3회 수정 시도 후에도 실패: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- dirty worktree override option을 추가하지 말 것. 이유: 이번 정책은 기본 중단으로 고정했다.
- metadata-only commit 전에 quality gate를 실행하지 말 것. 이유: 기존 timing은 feature/code commit 직전이다.
- commit 실패를 warning으로 넘기지 말 것. 이유: phase 상태와 git history 불일치를 막아야 한다.
- 기존 test를 깨뜨리지 말 것.
