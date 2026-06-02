# Harness validation과 dirty recovery policy를 분리한다

결정: Product quality gate는 SolveSync 제품 검증으로 유지하고 `npm run typecheck`, `npm test`, `npm run build`를 실행한다. Harness Python `unittest`는 `scripts/harness_self_test.py`와 `scripts/harness_tests/`로 runner tooling만 검증하는 별도 self-test다. Runner는 staged feature/code 변경이 harness-related path를 touch한 경우에만 harness self-test를 실행한다. Dirty preflight는 branch checkout이나 step 실행 전에 dirty worktree를 중단하지만, 현재 phase 복구 metadata인 `phases/index.json`과 `phases/{task-name}/index.json` 변경만 예외로 허용한다.
이유: 제품 회귀 검증과 runner tooling 검증을 같은 gate로 묶으면 제품 변경마다 불필요한 harness test가 실행되고, 반대로 harness 변경에서 tooling 회귀를 놓치기 쉽다. Recovery rerun은 index status를 `"pending"`으로 되돌린 상태에서 시작해야 하므로 해당 metadata만 dirty 예외로 둔다.
트레이드오프: Runner는 staged path를 기준으로 harness self-test 필요 여부를 판단해야 한다. Dirty recovery 예외는 현재 phase index metadata로 제한되므로 다른 dirty file은 rerun 전에 정리해야 한다.
