# 0001. Phase and Step Execution Model

## Status

Accepted

## Context

Codex 작업은 넓은 사용자 요청에서 시작하는 경우가 많다. 하지만 실행은 작고 검토 가능한 단위로 나눌 때 더 안정적이다. 이후 Codex session은 필요한 context가 파일에 적혀 있지 않으면 이전 대화 전체에 안전하게 의존할 수 없다.

## Decision

큰 작업은 `phases/{N-slug}/` 아래의 phase로 표현한다. Phase는 순서가 있는 `stepN.md` 파일들과 `phases/{phase}/index.json` metadata로 표현한다. 각 step은 fresh Codex session에서 독립 실행 가능해야 한다.

Step 파일은 읽을 파일, 작업 범위, acceptance criteria, 검증 지시, 구체적인 경고를 포함해야 한다. Step name은 짧은 kebab-case slug를 쓴다.

## Rationale

Phase/step 모델은 실행 전에 계획을 검토 가능하게 만들고, 각 sub-agent prompt의 범위를 제한한다. Runner 입장에서도 명확한 상태 모델이 생긴다. Pending step은 실행할 수 있고, completed step은 summary를 다음 step에 전달할 수 있으며, failed/blocked step은 metadata에서 복구할 수 있다.

## Consequences

큰 cross-module 변경은 step boundary를 명확히 해야 하므로 계획 비용이 늘어난다. 대신 실행을 resume, audit, retry하기 쉬워진다.
