# 0004. Validation and Dirty Recovery Policy

## Status

Accepted

## Context

Harness 작업은 product code와 runner tooling을 모두 바꿀 수 있다. Product regression과 harness runner regression은 서로 다른 검증 경로가 필요하다. 또한 recovery rerun 전에는 phase metadata를 `pending`으로 되돌려야 하는 경우가 많고, 이 과정에서 통제된 dirty state가 생긴다.

## Decision

Product quality gate는 SolveSync 제품 검증 경로로 유지하고 다음 command를 실행한다:

```bash
npm run typecheck
npm test
npm run build
```

Harness Python `unittest`는 `scripts/harness_self_test.py`와 `scripts/harness_tests/`를 사용하는 runner tooling self-test로 분리한다. Runner는 staged feature/code change가 harness-related path를 touch한 경우에만 harness self-test를 실행한다.

Dirty preflight는 worktree가 dirty이면 branch checkout이나 step 실행 전에 중단한다. 단, current phase recovery metadata는 예외로 허용한다:

- `phases/index.json`
- `phases/{phase}/index.json`

## Rationale

Product validation과 runner tooling validation은 결합하지 않는다. Product-only change마다 harness test를 실행하는 것은 불필요하고, harness-related change에서 tooling regression을 놓치는 것은 orchestration을 깨뜨릴 수 있다. Recovery rerun은 metadata를 `pending`으로 되돌린 상태에서 시작해야 하므로 current phase metadata만 dirty exception으로 허용한다.

## Consequences

Runner는 staged path를 확인해 harness self-test 필요 여부를 결정해야 한다. Phase를 다시 실행하기 전에 unrelated dirty file은 정리, commit, stash 또는 다른 방식으로 격리해야 한다.
