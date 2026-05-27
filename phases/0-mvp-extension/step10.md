# Step 10: integration-validation

## 읽을 파일

먼저 아래 파일을 읽고 architecture와 design intent를 이해한다:

- `/AGENTS.md`
- `/docs/PRD.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- `/docs/UI_GUIDE.md`
- `/docs/MANUAL_VALIDATION.md`
- `/manifest.json`
- `/package.json`
- `/vite.config.ts`
- `/src/background/index.ts`
- `/src/content/index.ts`
- `/src/options/index.ts`
- `/src/popup/index.ts`
- `/phases/0-mvp-extension/index.json`

수정하기 전에 전체 구현을 훑어보고 문서 요구사항과 어긋나는 부분을 찾는다.

## 작업

MVP 구현을 문서 기준으로 통합 점검하고, 빌드 가능한 unpacked extension 상태로 마무리한다.

점검 및 보완 범위:

- manifest permission이 최소 권한인지 확인한다.
- content script match가 `https://leetcode.com/problems/*`인지 확인한다.
- background service worker entry가 top-level runtime listener를 등록하는지 확인한다.
- Options/Popup HTML이 Vite build output에 포함되는지 확인한다.
- 모든 runtime message가 shared discriminated union 타입을 통과하는지 확인한다.
- PAT, LeetCode cookie, session token, 실제 secret이 source/test/docs 예시에 없는지 확인한다.
- LeetCode 문제 설명 전문 저장 경로가 없는지 확인한다.
- README/index/solution file이 같은 GitHub commit payload에 들어가는지 테스트로 확인한다.
- README marker 문자열이 정확한지 확인한다.
- Swift path가 `swift/leetcode`, Python3 path가 `python/leetcode`인지 확인한다.
- `swift/SwiftAlgorithm` 아래에 LeetCode solution path를 만드는 코드가 없는지 확인한다.
- branch 자동 생성이 없는지 확인한다. branch create는 Options action 경유여야 한다.
- connection test가 write request를 만들지 않는지 확인한다.
- retry payload cap/TTL과 성공 후 삭제가 테스트되는지 확인한다.
- UI 안내에 PAT와 retry payload local storage disclosure가 포함되는지 확인한다.

필요하면 focused tests를 추가한다. 문서 업데이트는 하지 않는다.

## 인수 기준

```bash
npm run typecheck
npm test
npm run build
```

추가 확인:

```bash
python3 scripts/quality_gate.py
```

## 검증

1. 인수 기준 command를 실행한다.
2. Architecture checklist를 확인한다:
   - 작업이 `ARCHITECTURE.md`의 directory structure를 따르는가?
   - `ADR.md`의 stack decision 안에 머무르는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
3. 이 step에 대해 `phases/0-mvp-extension/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "MVP extension passes typecheck, tests, build, quality gate, and document guardrail review"`를 추가한다.
   - 3회 수정 시도 후에도 실패: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- README를 수정하지 말 것. 이유: 사용자가 명시 요청하지 않았다.
- Chrome Web Store packaging, icon, privacy policy 작업을 추가하지 말 것. 이유: v2 범위다.
- 실제 LeetCode 또는 GitHub API를 테스트에서 호출하지 말 것. 이유: 단위 테스트는 mock 기반이어야 하고 secret이 필요 없어야 한다.
- 기존 test를 깨뜨리지 말 것.
