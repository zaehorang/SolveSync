# 0002. Runner-Owned Execution and Git History

## Status

Accepted

## Context

Sub-agent는 파일을 수정하고 acceptance criteria를 실행할 수 있다. 하지만 각 sub-agent가 branch 관리, commit, retry, finalization까지 소유하면 실행 정책이 중복되고 복구 방식이 일관되지 않게 된다.

## Decision

Runner가 execution orchestration과 git history를 소유한다. `scripts/execute.py`는 CLI entrypoint로 남고 `HarnessRunner`에 위임한다. Runner는 `feat-{phase}` branch를 checkout 또는 생성하고, step마다 하나의 sub-agent를 호출하고, step metadata를 읽고, code change와 metadata change를 commit하고, phase를 finalize하고, 요청된 경우 push한다.

Sub-agent는 `git commit`을 실행하지 않는다. Sub-agent는 현재 step을 구현하고, step acceptance criteria를 실행하고, 현재 step status를 `summary`, `error_message`, `blocked_reason` 중 필요한 field와 함께 업데이트한다.

## Rationale

실행 정책을 중앙화하면 branch naming, retry limit, timestamp, quality gate timing, commit split, finalization을 일관되게 유지할 수 있다. Step이 실패해도 runner는 임의의 sub-agent 동작을 추론하지 않고 metadata를 기준으로 retry, stop, finalize를 결정할 수 있다.

## Consequences

Runner가 더 강한 coordination point가 되므로 자체 테스트가 필요하다. Sub-agent prompt에는 commit 금지를 명시해야 한다.
