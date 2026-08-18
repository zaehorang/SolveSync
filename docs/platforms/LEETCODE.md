# LeetCode 연동 계약

> **Description**: LeetCode 전용 route, Accepted 감지, source 조회, 오류와 검증 계약을 정의한다. 공통 runtime과 sync 경계는 [ARCHITECTURE.md](../ARCHITECTURE.md)를 따른다.

## Route와 Accepted 감지

- 지원 route는 `/problems/{titleSlug}`다. Accepted 후보마다 현재 URL에서 `titleSlug`를 다시 추출한다.
- DOM은 Accepted event 감지에만 사용하고 solution code나 problem metadata의 source of truth로 사용하지 않는다.
- 짧은 결과 text인 `Accepted`와 `Accepted {passed} / {total} testcases passed`를 Accepted 신호로 사용한다.
- `Wrong Answer`, `Runtime Error`, `Compile Error`, `Time Limit Exceeded`, `Memory Limit Exceeded`, `Pending`, `Judging`, `Not Accepted`가 포함된 결과는 제외한다.
- `Accepted Submissions`, `Accepted Solutions`, `Acceptance Rate` 같은 일반 page copy는 제외한다.
- Text detector는 [ADR 0022](../adr/0022-bounded-mutation-text-traversal-for-accepted-detection.md)의 bounded mutation traversal을 따르고, 현재 DOM에 남아 있는 과거 Accepted 상태를 새 event로 재사용하지 않는다.
- 이전 Accepted DOM이 남은 상태의 Run, Wrong Answer, panel close와 unrelated mutation은 Accepted event가 아니며 GraphQL source 조회를 시작하지 않는다.

## Accepted Submission source

- Background는 content event의 `titleSlug`를 기준으로 현재 브라우저 로그인 session을 사용해 problem metadata와 최신 Accepted Submission detail을 조회한다.
- GraphQL API를 우선 사용하며 query와 response parsing은 LeetCode client 모듈에 중앙화한다.
- Solution code와 language는 조회된 Accepted Submission을 source of truth로 사용한다.
- Accepted Submission code를 가져오지 못하면 GitHub commit을 만들지 않는다.
- `acceptedSourceId`는 LeetCode submission ID를 사용한다. Sync Deduplication Key는 `codingPlatform`, `acceptedSourceId`, `titleSlug`, language 조합이다.
- 미지원 언어는 unsupported 상태로 기록하고 commit하지 않는다.

`content:accepted_detected` payload는 `codingPlatform: "leetcode"`, `titleSlug`, `pageUrl`, `detectedAt`을 포함한다. 이 값들은 같은 route-bound fresh Accepted event에서 확정한다.

## 오류 계약

- 로그인 만료나 browser session 문제는 `leetcode_auth_required`로 normalize한다.
- Problem metadata 또는 Accepted Submission 조회 실패는 `leetcode_fetch_failed`로 normalize한다.
- Run이나 Wrong Answer 뒤 stale Accepted를 재사용해 위 오류가 발생하지 않아야 한다.

## 자동 검증

Vitest에서 다음을 검증한다.

- 지원/비지원 route와 `titleSlug` parsing
- Accepted 결과 text와 제외 pattern
- `childList.addedNodes`와 non-Accepted → Accepted `characterData` transition
- stale Accepted target에 Run, Wrong Answer, panel close 또는 unrelated node가 추가돼도 event 0회
- hidden Accepted 후보와 removed Accepted node 제외
- traversal depth, text length와 candidate count cap
- 같은 render burst는 first event 하나만 전달
- route 변경 시 억제 창 초기화, 새 route event에는 현재 `titleSlug`와 URL 사용. 이미 전달한 event는 회수하지 않는다([ADR 0037](../adr/0037-immediate-accepted-delivery-with-suppression-window.md))
- GraphQL metadata/Accepted Submission parsing과 submission ID 기반 deduplication
- auth/fetch 실패 normalization

## 수동 검증

[공통 수동 검증](../MANUAL_VALIDATION.md)을 먼저 완료하고 다음을 실행한다.

1. LeetCode에 로그인하고 `/problems/{titleSlug}` 문제를 연다.
2. 실제로 선택 가능한 지원 언어로 Accepted 제출을 만든다.
3. toast가 Syncing에서 Synced로 바뀌고 Popup Sync History에 Commit과 File link가 생기는지 확인한다.
4. Test branch에서 solution file, `leetcode/README.md`, `leetcode/.leetcode-sync/index.json`이 같은 commit에 포함됐는지 확인한다.
5. Editor를 구별 가능한 새 code로 바꾸고 제출/채점이 아닌 Run만 실행한다. 새 toast, Sync History와 commit이 없어야 한다.
6. Wrong Answer 제출을 만들고 동일하게 sync가 없어야 하며 source 조회 오류 toast도 나타나지 않아야 한다.
7. 다시 Accepted 제출을 만들고 새 Solution Revision commit이 정확히 하나만 생기는지 확인한다.
8. SPA navigation으로 다른 문제에 이동해 Accepted를 만들고 현재 `titleSlug`와 path만 사용되는지 확인한다.

실제 token, cookie, session 값, private solution code와 문제 설명 전문은 screenshot, issue, fixture 또는 log에 남기지 않는다.
