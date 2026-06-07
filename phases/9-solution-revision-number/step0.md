# Step 0: domain-docs

## 읽을 파일

먼저 아래 파일을 읽고 제품 범위와 기존 결정의 의도를 이해한다:

- `/CONTEXT.md`
- `/docs/PRD.md`
- `/docs/ARCHITECTURE.md`
- `/docs/MANUAL_VALIDATION.md`
- `/docs/adr/0008-solution-catalog-as-readme-source-of-truth.md`
- `/docs/adr/0015-overwrite-latest-solution-for-same-problem-language.md`
- `/docs/adr/0016-processed-after-commit-success-only.md`
- `/docs/adr/0026-domain-naming-v4-storage-runtime-and-catalog-migration.md`

## 작업

Solution Revision Number의 문서 계약을 추가한다.

- `CONTEXT.md`에 **Solution Revision Number** 용어를 추가한다.
  - 의미: 같은 Coding Platform + problem + supported language의 Solution File이 Sync Branch에 실제 반영된 revision 번호.
  - Avoid: attempt number, retry count, submission count.
- `docs/PRD.md`의 성공 기준에 commit message가 같은 문제/언어의 revision 번호를 `#n` suffix로 포함해야 한다는 기준을 추가한다.
- `docs/ARCHITECTURE.md`를 갱신한다.
  - Solution Catalog는 v3 schema를 사용한다고 명시한다.
  - language entry에 `solutionRevisionNumber`가 저장된다고 명시한다.
  - commit message 형식을 `... #n`으로 갱신한다.
  - ref conflict retry와 Retry Bundle retry는 최신 Sync Branch의 Solution Catalog를 다시 읽어 files와 message를 함께 재계산한다고 명시한다.
- `docs/MANUAL_VALIDATION.md`에 수동 검증 항목을 추가한다.
  - 같은 문제+언어의 첫 성공 sync는 `#1`.
  - 같은 문제+언어의 다른 Accepted 재제출은 `#2`.
  - 같은 Accepted 재감지는 중복 commit도 revision 증가도 없어야 한다.
- 새 ADR 파일 `docs/adr/0027-solution-revision-numbered-commit-message.md`를 만든다.
  - 결정, 이유, tradeoff, migration 방식을 포함한다.
  - 별도 migration commit 없이 다음 성공 sync에서 v1/v2 Catalog를 v3로 반영한다고 명시한다.
  - Solution File은 계속 overwrite하고 Popup/Toast/README에는 번호를 표시하지 않는다고 명시한다.

## 인수 기준

```bash
npm test -- --run src/shared/indexFile.test.ts src/background/client/github.test.ts
```

## 검증

1. 인수 기준 command를 실행한다.
2. Architecture checklist를 확인한다:
   - 작업이 `ARCHITECTURE.md`의 directory structure를 따르는가?
   - `docs/adr/`의 stack decision 안에 머무르는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
3. 이 step에 대해 `phases/9-solution-revision-number/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "one-line output summary"`를 추가한다.
   - 현재 runner attempt에서 AC를 통과하지 못함: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- 제품/아키텍처 세부 규칙을 `AGENTS.md`에 복제하지 말 것. 이유: source of truth는 `docs/`와 ADR이다.
- Popup, Toast, README에 Solution Revision Number 표시를 추가하지 말 것. 이유: 이번 결정은 commit message에만 표시한다.
- 기존 test를 깨뜨리지 말 것.
