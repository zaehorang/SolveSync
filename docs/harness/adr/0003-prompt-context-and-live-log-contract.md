# 0003. Prompt Context and Live Log Contract

## Status

Accepted

## Context

각 step은 fresh Codex session에서 실행된다. Context를 주입하지 않으면 sub-agent가 repository guardrail, 이전 step 결과, retry 이유를 놓칠 수 있다. 실패를 복구하려면 지속 가능한 실행 증거도 필요하다.

## Decision

Runner는 각 step prompt를 다음 재료로 구성한다:

- `AGENTS.md`,
- sorted `docs/*.md` guardrail,
- completed step summary,
- previous attempt의 retry detail,
- 현재 `stepN.md` 본문.

CodexClient는 raw event stream을 `phases/{phase}/stepN-live.log`에 쓴다. Retry detail에는 previous error, live log path, observed commands, stderr tail이 포함된다. 성공적으로 finalize된 step의 live log는 삭제하고, failed/blocked log는 보존한다.

## Rationale

Guardrail injection은 sub-agent가 chat history에 의존하지 않고 project rule을 따르게 한다. Completed summary는 이전 step의 유용한 결과만 다음 step에 전달한다. Live log는 retry와 recovery를 추측이 아니라 증거 기반으로 만든다.

## Consequences

Guardrail 문서와 completed summary가 늘수록 prompt size가 커진다. Live log는 임시 실행 증거로 취급해야 하며 commit하면 안 된다.
