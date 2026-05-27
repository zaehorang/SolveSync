---
name: harness
description: "Use when this project uses the Harness workflow, when creating or reviewing phase/step plans, when creating phases/* files, when running scripts/execute.py, or when the user mentions the harness workflow."
---

# Harness 워크플로우

이 프로젝트는 Codex Harness 프레임워크를 사용한다. 단계별 구현 작업을 계획하고 실행할 때 아래 워크플로우를 따른다.

## 워크플로우

### A. 탐색

작업을 제안하기 전에 `docs/` 아래의 프로젝트 문서를 읽는다. 특히 `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/ADR.md`를 읽고 제품, 아키텍처, 설계 의도를 이해한다.

사용자가 명시적으로 sub-agent 또는 위임된 병렬 작업을 요청한 경우에만 병렬 탐색 agent를 사용한다.

### B. 논의

구현에 제품적 명확화나 기술적 결정이 필요하다면, 실행 파일을 만들기 전에 구체적인 결정 지점을 사용자에게 제시한다.

### C. Step 설계

사용자가 구현 계획을 요청하면 여러 step을 초안으로 작성하고, phase 파일을 쓰기 전에 피드백을 요청한다.

Step 설계 규칙:

1. **범위를 최소화한다**: 각 step은 하나의 layer 또는 module만 다뤄야 한다. 여러 module을 한 번에 수정해야 하는 step은 나눈다.
2. **각 step을 독립 실행 가능하게 만든다**: 각 step은 독립된 Codex session에서 실행된다. 이전 채팅 맥락에 의존하지 말고, step 파일 안에 필요한 세부 정보를 모두 포함한다.
3. **준비 작업을 강제한다**: session이 수정 전에 맥락을 읽도록 관련 문서 경로와 이전 step에서 생성 또는 변경된 파일을 나열한다.
4. **전체 구현이 아니라 interface를 지정한다**: 함수, class, module signature와 핵심 제약을 제공한다. 특정 algorithm이 정확성에 필수인 경우가 아니라면 구현 세부사항은 실행 agent에게 맡긴다.
5. **실행 가능한 acceptance criteria를 사용한다**: 모호한 문장보다 `npm run build`, `npm run test` 같은 command를 선호한다.
6. **경고를 구체적으로 작성한다**: 일반적인 주의 문구 대신 "X를 하지 말 것. 이유: Y." 형식으로 작성한다.
7. **kebab-case 이름을 사용한다**: step 이름은 `project-setup`, `core-types`, `api-layer`처럼 짧은 kebab-case slug를 사용한다.

### D. 파일 생성

사용자 승인 후 아래 파일을 생성하거나 업데이트한다.

#### `phases/index.json`

최상위 phase index다. 이미 존재한다면 새 task를 `phases`에 append한다.

```json
{
  "phases": [
    {
      "dir": "0-mvp",
      "status": "pending"
    }
  ]
}
```

규칙:

- `dir`: task directory 이름.
- `status`: `"pending"`, `"completed"`, `"error"`, `"blocked"` 중 하나.
- 생성 시 timestamp를 추가하지 않는다. `scripts/execute.py`가 실행 중 기록한다.

#### `phases/{task-name}/index.json`

Task 세부 index다.

```json
{
  "project": "<project-name>",
  "phase": "<task-name>",
  "steps": [
    { "step": 0, "name": "project-setup", "status": "pending" },
    { "step": 1, "name": "core-types", "status": "pending" },
    { "step": 2, "name": "api-layer", "status": "pending" }
  ]
}
```

규칙:

- `project`: `AGENTS.md`에 있는 project 이름.
- `phase`: task name이며 directory name과 일치해야 한다.
- `steps[].step`: 0부터 시작하는 step number.
- `steps[].name`: kebab-case slug.
- `steps[].status`: 초기값은 `"pending"`.

Status field:

| 전환 | 기록되는 field | 작성 주체 |
| --- | --- | --- |
| to `completed` | `completed_at`, `summary` | Codex session이 `summary`를 쓰고, `execute.py`가 timestamp를 쓴다 |
| to `error` | `failed_at`, `error_message` | Codex session이 message를 쓰고, `execute.py`가 timestamp를 쓴다 |
| to `blocked` | `blocked_at`, `blocked_reason` | Codex session이 reason을 쓰고, `execute.py`가 timestamp를 쓴다 |

`summary`는 다음 step에 유용한 한 줄 설명이어야 하며, 생성한 파일, 변경한 파일, 핵심 결정을 포함한다.

`created_at` 또는 step-level `started_at`을 수동으로 추가하지 않는다. `execute.py`가 기록한다.

#### `phases/{task-name}/step{N}.md`

Step마다 Markdown 파일을 하나씩 만든다.

````markdown
# Step {N}: {name}

## 읽을 파일

먼저 아래 파일을 읽고 architecture와 design intent를 이해한다:

- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- {이전 step에서 생성 또는 변경한 파일}

수정하기 전에 이전 step에서 작성된 code를 주의 깊게 읽는다.

## 작업

{구체적인 구현 지시사항. 파일 경로, class/function signature, 동작 제약을 포함한다. 특정 구현이 꼭 필요한 경우가 아니라면 snippet은 interface/signature 수준으로 유지한다.}

## 인수 기준

```bash
npm run build
npm run test
```

## 검증

1. 인수 기준 command를 실행한다.
2. Architecture checklist를 확인한다:
   - 작업이 `ARCHITECTURE.md`의 directory structure를 따르는가?
   - `ADR.md`의 stack decision 안에 머무르는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
3. 이 step에 대해 `phases/{task-name}/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "one-line output summary"`를 추가한다.
   - 3회 수정 시도 후에도 실패: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- {구체적인 금지 행동. 형식: "X를 하지 말 것. 이유: Y."}
- 기존 test를 깨뜨리지 말 것.
````

### E. 실행

계획된 task를 실행해 달라고 사용자가 요청한 경우에만 실행한다.

```bash
python3 scripts/execute.py {task-name}
python3 scripts/execute.py {task-name} --push
```

`execute.py`가 처리하는 일:

- `feat-{task-name}` branch 생성 및 checkout
- `AGENTS.md`와 `docs/*.md`의 guardrail 주입
- 완료된 step summary를 이후 step prompt에 전달
- 실패한 step을 이전 error message와 함께 최대 3회 재시도
- code change와 metadata를 두 개의 commit으로 분리
- 자동 커밋 전에 `scripts/quality_gate.py` 실행
- `started_at`, `completed_at`, `failed_at`, `blocked_at` 기록

실행 계약:

- 하위 Codex agent는 step 구현, 인수 기준 실행, `phases/{task-name}/index.json` status/summary 업데이트까지만 수행한다.
- 하위 Codex agent에게 `git commit`을 지시하지 않는다. Step별 commit은 `execute.py` runner가 수행한다.
- 메인 agent는 `scripts/execute.py` 실행 중단 후 step 파일을 따라 남은 구현을 수동으로 이어서 하지 않는다.
- 실행이 오래 걸리거나 멈춘 것처럼 보이면 `phases/{task-name}/stepN-live.log`를 확인한다.

복구:

- `error` step의 경우 `phases/{task-name}/index.json`을 수정해 해당 step을 `"pending"`으로 되돌리고 `error_message`를 삭제한 뒤 다시 실행한다.
- `blocked` step의 경우 `blocked_reason`을 해결하고 해당 step을 `"pending"`으로 되돌린 뒤 `blocked_reason`을 삭제하고 다시 실행한다.
- runner가 kill되거나 비정상 중단된 경우 메인 agent는 phase index, live log, git status만 확인한다. 복구 가능하면 status를 정리한 뒤 `python3 scripts/execute.py {task-name}`로 같은 runner 경로를 다시 탄다.
