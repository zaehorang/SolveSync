# Step 0: shared-platform-core

## 읽을 파일

먼저 아래 파일을 읽고 architecture와 design intent를 이해한다:

- `/docs/PRD.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- `/AGENTS.md`
- `/src/shared/types.ts`
- `/src/shared/messages.ts`
- `/src/shared/storageSchema.ts`
- `/src/shared/language.ts`
- `/src/shared/paths.ts`
- `/src/shared/indexFile.ts`
- `/src/shared/readme.ts`
- `/src/shared/errorNormalize.ts`
- `/src/shared/errors.ts`
- `/src/background/storage.ts`

수정하기 전에 기존 shared tests를 읽고 LeetCode 현재 동작을 확인한다.

## 작업

Shared layer를 LeetCode-only에서 platform-aware 계약으로 확장한다. 이 step은 shared module과 storage compatibility만 다룬다. Content UI, background GitHub commit orchestration, popup/options DOM 구현은 다음 step에서 처리한다.

필수 계약:

- `Platform = "leetcode" | "programmers"` 타입을 추가한다.
- `SubmissionIdentity`에 `platform`을 추가한다.
- `SyncRecord`, `RetryPayload`, retry summary, processed/in-flight identity 관련 타입이 platform-aware identity를 사용하게 한다.
- 기존 storage v1 데이터가 삭제되지 않도록 schema version을 올리고 legacy identity/history/retry/in-flight 값에는 `platform: "leetcode"`를 채우는 migration 또는 tolerant parser를 구현한다.
- `programmers_extract_failed` error code와 사용자 메시지를 추가한다.
- LeetCode와 Programmers 공통 `SupportedLanguage`는 계속 `"swift" | "python3"`만 허용한다.
- language mapping은 LeetCode/Programmers raw label 모두에서 Swift와 Python3를 지원한다. Python, JavaScript 등은 null 또는 unsupported로 남긴다.
- platform policy module을 추가하거나 기존 shared module에 동등한 순수 함수를 둔다. 최소 제공 정보는 root folder, language folder, extension, README path, index path, managed markers, initial README title, commit platform label이다.
- path 생성은 platform을 입력받아 다음 결과를 만들 수 있어야 한다.
  - LeetCode Swift: `leetcode/swift/0001_two_sum.swift`
  - LeetCode Python3: `leetcode/python/0001_two_sum.py`
  - Programmers Swift: `programmers/swift/120804_두_수의_곱_구하기.swift`
  - Programmers Python3: `programmers/python/120804_두_수의_곱_구하기.py`
- Programmers filename sanitizer는 한글 제목을 보존하고 공백/구두점은 `_`로 정규화한다.
- index/readme 생성은 platform policy를 받도록 일반화한다. LeetCode 기존 API가 많이 쓰이는 경우 backward-compatible wrapper를 남겨도 된다.
- README managed marker는 platform별 marker만 교체하고 marker 밖 내용은 보존한다.
- `content:accepted_detected` runtime message는 platform discriminated union으로 확장한다. 단, LeetCode 기존 payload 흐름이 compile되도록 call site도 최소 수정한다.

테스트:

- 기존 LeetCode shared tests는 계속 통과해야 한다.
- platform policy, Programmers path, Programmers marker/readme, platform-aware identity guard, storage migration/tolerant parsing, `programmers_extract_failed` normalization tests를 추가한다.

## 인수 기준

```bash
npm run build
npm test
```

## 검증

1. 인수 기준 command를 실행한다.
2. Architecture checklist를 확인한다:
   - 작업이 `ARCHITECTURE.md`의 directory structure를 따르는가?
   - `ADR.md`의 stack decision 안에 머무르는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
3. 이 step에 대해 `phases/1-programmers-support/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "one-line output summary"`를 추가한다.
   - 3회 수정 시도 후에도 실패: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- Content script에서 Programmers DOM selector를 구현하지 말 것. 이유: 이 step은 shared platform contract만 확정한다.
- GitHub client의 network 동작을 바꾸지 말 것. 이유: platform support는 commit payload 생성 전 단계에서 해결한다.
- 실제 PAT, cookie, session token, 사용자 private code를 fixture에 넣지 말 것. 이유: AGENTS.md CRITICAL 보안 규칙 위반이다.
- 기존 test를 깨뜨리지 말 것.
