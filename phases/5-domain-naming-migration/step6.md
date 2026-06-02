# Step 6: accepted-editor-snapshot

## 읽을 파일

먼저 아래 파일을 읽고 Programmers content extraction 흐름을 이해한다:

- `/CONTEXT.md`
- `/AGENTS.md`
- `/docs/ARCHITECTURE.md`
- `/docs/adr/0011-external-api-clients-in-background.md`
- `/docs/adr/0024-coding-platform-adapters-and-shared-sync-core.md`
- `/docs/adr/0026-domain-naming-v4-storage-runtime-and-catalog-migration.md`
- `/src/content/index.ts`
- `/src/content/detector.ts`
- `/src/content/index.test.ts`
- `/src/content/detector.test.ts`
- `/src/background/sync.ts`
- `/src/background/sync.test.ts`

수정하기 전에 Step 4와 Step 5에서 바뀐 runtime payload와 UI naming을 확인한다.

## 작업

Programmers Accepted Editor Snapshot naming을 코드와 테스트에서 정렬한다.

구현 요구사항:

- `ProgrammersAcceptedSnapshot` -> `ProgrammersAcceptedEditorSnapshot`
- `extractProgrammersAcceptedSnapshot` -> `extractProgrammersAcceptedEditorSnapshot`
- `createProgrammersAcceptedDetectedMessage` parameter naming도 `acceptedEditorSnapshot` 기준으로 정리한다.
- Test descriptions에서 “snapshot” 단독 표현을 `Accepted Editor Snapshot`으로 구체화한다.
- Runtime payload field names are still practical message data:
  - `courseId`
  - `lessonId`
  - `problemTitle`
  - `language`
  - `code`
  - `pageUrl`
  - `detectedAt`
- Background sync code should keep using accepted source terminology after it receives the message.

## 인수 기준

```bash
npm run typecheck
npm test -- src/content/index.test.ts src/content/detector.test.ts src/background/sync.test.ts
npm run build
```

## 검증

1. 인수 기준 command를 실행한다.
2. `rg -n "ProgrammersAcceptedSnapshot|extractProgrammersAcceptedSnapshot|accepted snapshot|editor snapshot" src docs AGENTS.md`를 실행한다.
   - 결과는 `Accepted Editor Snapshot` 표준 용어 또는 explicit avoid list에만 남아야 한다.
3. 이 step에 대해 `phases/5-domain-naming-migration/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "Programmers Accepted Editor Snapshot naming applied in content extraction and tests"`를 추가한다.
   - 현재 runner attempt에서 AC를 통과하지 못함: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- Programmers 공식 제출 상세 API 의존을 추가하지 말 것. 이유: v1은 Accepted Editor Snapshot 기반이다.
- `textarea#code.value` primary source policy를 바꾸지 말 것. 이유: 실제 Chrome 검증으로 확인된 source of truth다.
- message payload에 token, cookie, session 값을 넣지 말 것. 이유: security rule 위반이다.
- 기존 test를 깨뜨리지 말 것.
