# LeetCode 연동 계약

> **Description**: LeetCode 전용 route, Accepted 감지, source 조회, 오류와 검증 계약을 정의한다. 공통 계약은 [Coding Platform 연동 계약](README.md)을 따른다.

## Route와 Accepted 감지

> **관찰 강도: 가정.** 이 절의 DOM 계약은 **실제 제출로 확인된 적이 없고 관찰 일자 기록도 없다.** 세 플랫폼 중 근거가 가장 약하다. Accepted 결과 panel의 실제 구조, 결과 text가 node 추가로 오는지 text 교체로 오는지, 결과 panel이 재사용되는지 전부 미확인이다. Live E2E 실제 제출로 실증한 뒤 이 경고를 관찰 강도 표기로 교체한다.


- 지원 route는 `/problems/{titleSlug}`다. Accepted 후보마다 현재 URL에서 `titleSlug`를 다시 추출한다.
- 짧은 결과 text인 `Accepted`와 `Accepted {passed} / {total} testcases passed`를 Accepted 신호로 사용한다. 세 플랫폼 중 유일하게 **결과 text 후보인지 선별하는 단계가 하나 더 있다.** 문제 page에 `Acceptance Rate` 같은 일반 copy가 많아 단어 일치만으로는 결과와 구분되지 않기 때문이다.
- `Wrong Answer`, `Runtime Error`, `Compile Error`, `Time Limit Exceeded`, `Memory Limit Exceeded`, `Pending`, `Judging`, `Not Accepted`가 포함된 결과는 제외한다.
- `Accepted Submissions`, `Accepted Solutions`, `Acceptance Rate` 같은 일반 page copy는 제외한다.
- DOM은 Accepted event 감지에만 사용하고 solution code나 problem metadata의 source of truth로 사용하지 않는다.
- Non-Accepted 경로에서는 GraphQL source 조회 자체를 시작하지 않는다.

## 검증 기준 문제

`https://leetcode.com/problems/two-sum/`.

`acceptedSourceId`가 플랫폼 공식 submission ID라 같은 code를 다시 제출해도 새 값이 나온다. 세 플랫폼 중 유일하게 Sync Deduplication Key 오염을 걱정하지 않아도 되는 경우다. Page 구조도 가장 안정적이다.

바꾸면 이전 캡처와의 비교가 끊기므로 [`e2e/capture/baseProblems.ts`](../../e2e/capture/baseProblems.ts)와 함께 고친다.

## Accepted Submission source

- Background는 content event의 `titleSlug`를 기준으로 현재 브라우저 로그인 session을 사용해 problem metadata와 최신 Accepted Submission detail을 조회한다.
- GraphQL API를 우선 사용하며 query와 response parsing은 LeetCode client 모듈에 중앙화한다.
- Solution code와 language는 조회된 Accepted Submission을 source of truth로 사용한다.
- Accepted Submission code를 가져오지 못하면 GitHub commit을 만들지 않는다.
- `acceptedSourceId`는 LeetCode submission ID를 사용한다. 플랫폼이 공식 ID를 노출하는 유일한 경우라 code hash를 쓰지 않는다.

`content:accepted_detected` payload는 `codingPlatform: "leetcode"`, `titleSlug`, `pageUrl`, `detectedAt`을 포함한다. 이 값들은 같은 route-bound fresh Accepted event에서 확정한다.

## 오류 계약

- 로그인 만료나 browser session 문제는 `leetcode_auth_required`로 normalize한다.
- Problem metadata 또는 Accepted Submission 조회 실패는 `leetcode_fetch_failed`로 normalize한다. 세 플랫폼 중 retry가 가능한 유일한 실패다.
- Run이나 Wrong Answer 뒤 stale Accepted를 재사용해 위 오류가 발생하지 않아야 한다.

## 자동 검증

Vitest에서 다음을 검증한다.

- 지원/비지원 route와 `titleSlug` parsing
- `src/content/platforms/leetcode.test.ts`가 route와 Accepted 결과 text 판정을 덮고, `src/content/platforms/contract.test.ts`가 세 Adapter 공통 계약을 덮는다.
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

[공통 수동 검증 골격](README.md#검증-공통-계약)을 먼저 실행하고 다음을 추가로 확인한다.

1. `/problems/{titleSlug}` 문제를 열고 실제로 선택 가능한 지원 언어로 Accepted를 만든다.
2. Test branch에 `leetcode/README.md`와 `leetcode/.leetcode-sync/index.json`이 solution file과 같은 commit에 포함됐는지 확인한다.
3. Wrong Answer 제출에서 sync가 없을 뿐 아니라 **source 조회 오류 toast도 나타나지 않는지** 확인한다. LeetCode만 실패 시 GraphQL 조회 경로가 있어 stale Accepted를 재사용하면 여기서 드러난다.
4. SPA navigation으로 다른 문제에 이동해 Accepted를 만들고 현재 `titleSlug`와 path만 사용되는지 확인한다.
