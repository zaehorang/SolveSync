# Harness Architecture

이 문서는 SolveSync 저장소에서 Codex Harness 작업을 계획, 실행, 복구하는 구조를 설명한다. SolveSync 제품 아키텍처 문서가 아니다. 제품 범위, runtime 동작, UI 규칙, extension 검증 절차는 기존 `docs/` 제품 문서를 따른다.

대상 독자는 다음과 같다:

- 새 phase를 설계하는 human 또는 main agent,
- `scripts/execute.py`를 실행하는 operator,
- 독립 step을 수행하는 sub-agent,
- harness runner를 수정하는 maintainer.

## Core Concepts

Harness는 큰 구현 요청을 추적 가능한 phase로 만들고, phase를 독립 실행 가능한 step으로 나눈다.

| Concept | Meaning |
| --- | --- |
| Main agent | 사용자와 대화하고 문서를 읽어 phase와 step을 설계하는 현재 Codex session. |
| Phase | `phases/{N-slug}/` 아래에 있는 하나의 작업 단위. |
| Step | fresh headless Codex session이 실행하는 최소 작업 단위. |
| Runner | `scripts/execute.py`로 시작되는 Python orchestration. |
| CodexClient | Runner 안에서 `codex exec --json`, live log, timeout, retry detail을 담당하는 adapter. |
| Sub-agent | Runner가 step 하나를 맡기기 위해 호출하는 headless Codex session. |
| Metadata | `phases/index.json`, `phases/{phase}/index.json`; 진행 상태의 source of truth. |
| Live log | `phases/{phase}/stepN-live.log`; retry와 recovery를 위한 실행 증거. |

Runner와 main agent는 같은 역할이 아니다. Main agent는 계획을 만들고 사용자와 결정한다. Runner는 그 계획을 파일에서 읽어 실행한다. CodexClient는 Runner 내부의 process adapter이고, Sub-agent는 CodexClient가 띄우는 step 단위 headless Codex session이다.

Step마다 headless Codex session을 새로 쓰는 이유는 context를 격리하기 위해서다. 각 step은 이전 chat에 기대지 않고 `AGENTS.md`, 관련 `docs/`, completed step summary, retry detail, `stepN.md`만 보고 실행해야 한다. 이렇게 해야 retry와 recovery가 기억이 아니라 metadata와 live log에 근거한다.

## Visual Overview

```mermaid
flowchart LR
  User["User"]
  Main["1. Plan<br/>Main agent"]
  Files["2. Write files<br/>phase index<br/>step docs"]
  Runner["3. Execute<br/>Runner"]
  Client["CodexClient<br/>headless exec"]
  Sub["Sub-agent<br/>one step"]
  Metadata["Step status<br/>metadata"]
  Git["4. Commit<br/>Runner + GitOps"]

  User --> Main
  Main --> Files
  Files --> Runner
  Runner --> Client
  Client --> Sub
  Sub --> Metadata
  Metadata --> Git
```

## Responsibility Boundaries

Harness는 계획, 실행, 구현, git history를 분리한다.

| Owner | Responsibility |
| --- | --- |
| Main agent | 문서를 탐색하고 사용자 의도를 정리해 phase/step 파일을 설계한다. |
| Runner | metadata 검증, step 실행, retry, finalize, 요청 시 push를 담당한다. |
| CodexClient | Codex process 실행, log stream, timeout, retry detail 생성을 담당한다. |
| Sub-agent | 현재 step 구현, acceptance criteria 실행, step status 업데이트를 담당한다. |
| GitOps | dirty check, branch 관리, commit 분리, quality gate 실행을 담당한다. |

Sub-agent는 commit하지 않는다. Runner가 sub-agent가 기록한 status를 읽고 code change와 metadata change를 commit한다.

## User Journey

### 1. Plan Phase

**상황:** 큰 구현 작업을 작은 실행 단위로 나눠야 한다.

**목표:** 각 step이 fresh Codex session에서 독립 실행될 수 있는 phase를 만든다.

**흐름:**

1. `AGENTS.md`와 관련 `docs/` source-of-truth 파일을 읽는다.
2. scope, success criteria, 미결정 지점을 정리한다.
3. 작업을 layer 또는 module 기준으로 나눈다.
4. `phases/index.json`에 phase를 등록한다.
5. `phases/{phase}/index.json`에 pending step 목록을 만든다.
6. 각 `stepN.md`에 읽을 파일, 작업, acceptance criteria, 검증, 명시적 경고를 적는다.

**성공 상태:** 모든 step이 이전 chat에 의존하지 않고 실행될 만큼 충분한 context를 가진다.

### 2. Execute Phase

**상황:** phase 파일이 준비되었고 구현을 Runner에 위임하려 한다.

**목표:** pending step을 순서대로 실행하고 code와 metadata를 일관되게 commit한다.

**흐름:**

1. `python3 scripts/execute.py {phase-dir}`를 실행한다.
2. Runner가 top index와 phase index 정합성을 검증한다.
3. Runner가 unrelated dirty worktree 상태를 차단한다.
4. Runner가 `feat-{phase}` branch를 checkout하거나 생성한다.
5. Runner가 guardrails, previous summaries, retry detail, `stepN.md`로 prompt를 만든다.
6. CodexClient가 `codex exec --json`으로 sub-agent 하나를 호출한다.
7. Runner가 step status를 읽고 commit, retry, stop 중 하나를 결정한다.

**성공 상태:** 모든 step이 `completed`가 되고, phase metadata가 finalize되며, commit은 Runner가 만든다.

### 3. Retry Failed Step

**상황:** Sub-agent가 step을 완료하지 못하고 종료했거나 error를 기록했다.

**목표:** 다음 attempt가 실패 원인을 볼 수 있게 증거를 남기고, attempt가 소진되면 명확한 error 상태로 멈춘다.

**흐름:**

1. Codex가 종료되면 Runner가 현재 step status를 다시 읽는다.
2. Step이 `completed`가 아니면 CodexClient가 retry detail을 만든다.
3. Retry detail에는 previous error, live log path, observed commands, stderr tail이 들어간다.
4. Attempt가 남아 있으면 Runner가 step을 `pending`으로 되돌리고 다음 attempt를 호출한다.
5. Attempt가 소진되면 Runner가 `error_message`와 `failed_at`을 기록한다.
6. Top-level phase status는 `error`가 된다.

**성공 상태:** Retry 중 step이 완료되거나, 복구 판단에 필요한 실패 증거가 metadata에 남는다.

### 4. Recover Phase

**상황:** Blocker, timeout, failed attempts, runner kill, dirty worktree 때문에 phase가 멈췄다.

**목표:** Runner가 다시 읽고 재개할 수 있는 metadata 상태로 복구한다.

**흐름:**

1. `phases/{phase}/index.json`을 확인한다.
2. `stepN-live.log`가 있으면 확인한다.
3. `git status --porcelain`으로 dirty state를 확인한다.
4. 실패 command, missing input, auth issue, unrelated dirty state 같은 실제 원인을 해결한다.
5. 관련 step을 `pending`으로 되돌린다.
6. `error_message` 또는 `blocked_reason`을 삭제한다.
7. `python3 scripts/execute.py {phase-dir}`를 다시 실행한다.

**성공 상태:** 같은 Runner 경로가 다음 pending step부터 재개한다.

## Data Model

`phases/index.json`은 phase registry다. 각 entry는 `dir`과 `status`를 가진다. `dir`은 `N-slug` 형식을 쓰며, `N`은 registry의 0-based 순서와 일치해야 한다.

`phases/{phase}/index.json`은 phase의 상세 상태다. 각 step은 다음 필드를 가진다:

- `step`: 0부터 시작하는 연속 번호,
- `name`: kebab-case step slug,
- `status`: `pending`, `completed`, `error`, `blocked`,
- optional `max_attempts`: retry override, 기본값 `3`,
- optional `timeout_sec`: Codex execution timeout override, 기본값 `1800`.

Completed step은 `summary`를 포함해야 한다. 이 summary는 이후 step prompt에 전달된다.

`stepN.md`는 sub-agent에게 전달되는 작업 지시서다. 다음 내용을 포함해야 한다:

- 읽을 파일,
- 작업 지시,
- acceptance criteria,
- 검증 checklist,
- 명시적 "하지 말 것" 경고.

`stepN-live.log`는 active 또는 failed step의 임시 증거 파일이다. 성공적으로 finalize된 step의 live log는 삭제되고, failed/blocked log는 복구를 위해 보존된다.

## Execution Flow

```mermaid
sequenceDiagram
  participant Operator
  participant Runner
  participant GitOps
  participant CodexClient
  participant SubAgent
  participant Metadata

  Operator->>Runner: 1. start phase
  Runner->>Metadata: 2. validate indexes
  Runner->>GitOps: 3. prepare branch
  Runner->>Metadata: 4. build prompt context
  Runner->>CodexClient: 5. invoke step
  CodexClient->>SubAgent: 6. codex exec
  SubAgent->>Metadata: 7. write step status
  CodexClient-->>Runner: 8. return run evidence
  Runner->>Metadata: 9. read status

  alt completed
    Runner->>GitOps: 10. gate and commit code
    Runner->>GitOps: 11. commit metadata
  else retryable failure
    Runner->>Runner: reset pending and retry
  else blocked
    Runner->>Metadata: mark blocked_at
    Runner-->>Operator: stop
  end
```

이 flow의 핵심은 세 가지다. Runner는 깨진 phase 파일과 unrelated dirty state를 실행 전에 막는다. Sub-agent는 주입된 guardrail과 step file만 보고 작업한다. Retry와 recovery는 live log와 metadata를 기준으로 판단한다.

## Step Status State Machine

```mermaid
flowchart TD
  Start(("start"))
  Pending["pending"]
  Result{"step result"}
  Retry["retry attempt"]
  Done["completed"]
  Error["error"]
  Blocked["blocked"]
  Reset["reset metadata"]
  End(("end"))

  Start --> Pending
  Pending --> Result
  Result -->|"pass"| Done
  Result -->|"retry"| Retry
  Result -->|"fail"| Error
  Result -->|"blocked"| Blocked
  Retry --> Pending
  Done --> End
  Error --> Reset
  Blocked --> Reset
  Reset --> Pending
```

Step status는 sub-agent와 Runner 사이의 계약이다. Sub-agent는 결과를 metadata에 기록하고, Runner는 metadata를 읽어 다음 행동을 결정한다.

## Validation And Commit Policy

Product quality gate는 SolveSync 제품 동작을 검증한다:

```bash
npm run typecheck
npm test
npm run build
```

Harness self-test는 `scripts/harness_self_test.py`와 `scripts/harness_tests/`로 runner tooling을 검증한다.

Runner commit policy:

- Feature/code change는 harness metadata와 별도 commit으로 분리한다.
- Product quality gate는 feature/code commit 직전에만 실행한다.
- Metadata-only commit 전에는 product quality gate를 실행하지 않는다.
- Harness self-test는 staged feature/code change가 harness-related path를 touch한 경우에만 실행한다.
- Commit failure와 gate failure는 hard failure다.

이 정책은 product regression check와 runner tooling check를 분리하면서, git history를 읽기 쉽게 유지한다.

## Recovery Playbook

```mermaid
flowchart TD
  Start["1. Phase stopped"]
  Check["2. Read phase index"]
  Status{"Step status"}
  Error["Read error evidence"]
  Blocked["Read blocked reason"]
  Dirty["Check dirty state"]
  Fix["Fix cause"]
  Reset["Reset step to pending"]
  Rerun["Run execute.py again"]
  Isolated{"Metadata-only dirty?"}
  Clean["Clean unrelated changes"]

  Start --> Check
  Check --> Status
  Status -->|"error"| Error
  Status -->|"blocked"| Blocked
  Status -->|"pending"| Dirty
  Status -->|"not finalized"| Rerun
  Error --> Fix
  Blocked --> Fix
  Dirty --> Isolated
  Isolated -->|"yes"| Rerun
  Isolated -->|"no"| Clean
  Clean --> Rerun
  Fix --> Reset
  Reset --> Rerun
```

복구할 때 확인할 파일과 명령은 다음과 같다:

- Phase metadata: `phases/{phase}/index.json`
- Live log: `phases/{phase}/stepN-live.log`
- Dirty state: `git status --porcelain`
- Rerun command: `python3 scripts/execute.py {phase-dir}`

복구는 main agent가 step을 수동으로 이어서 구현하는 방식이 아니다. 같은 Runner 경로로 돌아가야 retry limit, timestamp, commit, quality gate, finalization 규칙이 유지된다.
