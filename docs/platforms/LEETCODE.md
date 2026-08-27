# LeetCode 연동 계약

> **Description**: LeetCode 전용 route, Accepted 감지, source 조회, 오류와 검증 계약을 정의한다. 공통 계약은 [Coding Platform 연동 계약](README.md)을 따른다.

이 문서는 **구현 계약**이다. 같은 연동을 그 기술을 모르는 사람이 검수할 수 있게 사용자 관점 동작으로 다시 쓴 명세가 따로 있고, 둘이 어긋나면 이 문서가 맞다. [정답 감지](../specs/leetcode/accepted-detection.md), [풀이 조회](../specs/leetcode/submission-lookup.md), [풀이를 조회하지 못했을 때](../specs/leetcode/lookup-failure.md), [같은 제출 중복 방지](../specs/leetcode/duplicate-prevention.md), [저장 실패 다시 시도](../specs/leetcode/retry.md), [저장 위치와 목록](../specs/leetcode/repository-layout.md) 여섯이다.

## Route와 Accepted 감지

> **관찰 강도: 실증 2026-08-25.** 기준 문제로 정답·오답을 실제 제출해 캡처했다. 근거는 [`e2e/fixtures/leetcode/`](../../e2e/fixtures/leetcode/)의 `accepted.json`·`rejected.json`이다. 결과 panel이 두 번째 제출에서 재사용되는지는 아직 확인하지 않았다 — 이번 캡처는 정답·오답 각 1회씩이다.

### 실증된 판정 전이

**판정은 대기 text가 제자리에서 바뀌며 온다. node 추가가 아니다.** 두 캡처 모두 `characterData` mutation 하나로 왔다.

| 캡처 | 전이 | mutation |
| --- | --- | --- |
| 정답 | `Judging...` → `Accepted` | `characterData` |
| 오답 | `Pending...` → `Wrong Answer` | `characterData` |

대기 text는 `Pending...`과 `Judging...` 두 가지이고 둘 사이를 오간 뒤 판정으로 바뀐다. 정답 캡처는 `Judging...`에서, 오답 캡처는 `Pending...`에서 넘어갔다. 어느 쪽에서 넘어올지 고정으로 보지 않는다.

**이 page는 조용해지지 않는다.** 제출과 무관하게 `<head>`에 style tag가 계속 삽입돼 idle 상태에서도 초당 약 30개의 mutation이 발생한다. 침묵 기반으로 채점 완료를 판정할 수 없다. 채점 중간에 몇 초씩 조용해지는 polling 간격도 있어 침묵을 완료로 착각하기 쉽다.

**결과 text를 문자열 검색으로 찾으면 안 된다.** 문제 page에는 `Accepted 23,208,748/40M` 같은 통계 copy가 있어 제출 전부터 `Accepted`가 DOM에 들어 있다. 실제로 이 방식으로 캡처했을 때 판정이 오기 전에 신호가 걸려 `Judging...` 상태에서 멈춘 fixture가 만들어졌다. 위 표의 **전이**를 봐야 한다. 이 판정 방식은 캡처 도구([`e2e/capture/runCapture.ts`](../../e2e/capture/runCapture.ts)의 `verdictArrived`)에 그대로 들어 있다.

**page에 Monaco editor가 둘 있다.** `monaco.editor.getEditors()`가 2개를 돌려주고 순서는 보장되지 않는다(실측 2026-08-25). `[0]`을 풀이 editor로 가정하면 엉뚱한 editor에 코드가 들어가 이전 내용이 그대로 제출된다 — 컴파일되는 풀이가 `Compile Error`로 돌아온 캡처가 실제로 나왔다. **크기로 고르는 것도 안 된다.** page 로드 직후에는 아직 배치되지 않아 두 editor가 25px과 0px로 나온다. 구분자는 model의 language다 — 풀이 editor는 선택한 언어(`cpp`)이고 다른 하나는 테스트케이스 입력이라 `plaintext`다. 제품 content script는 LeetCode에서 code를 읽지 않으므로(GraphQL이 source of truth) 이 문제는 캡처 자동화에만 해당한다.

**제출 결과 panel은 제출한 code를 다시 그린다.** 판정 text가 오는 바로 그 node 안에 `Code` section이 있고 거기에 방금 제출한 source가 줄 번호와 함께 렌더된다. 그 panel을 통째로 버리면 판정도 함께 사라지므로, 캡처는 제출한 code의 줄을 redaction 대상으로 등록해 UI 문구는 남기고 code만 지운다. page의 hydration `<script>`에도 직전 제출 code가 JSON으로 들어 있어 함께 버린다.

**editor에 쓴 값이 나중에 덮어써진다.** page가 뜬 뒤에도 저장해 둔 직전 풀이를 editor에 복원하는데, 그 복원이 우리가 쓴 값보다 늦게 오면 editor가 조용히 예전 code로 돌아간다. 써 넣고 되읽어 값이 유지되는지 확인해야 한다.

이것은 adapter가 결과 text 후보를 한 번 더 선별하는 이유이기도 하다. 아래 규칙이 그 선별이다.

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

`e2e/sealed.spec.ts` + `e2e/drivers/leetcode.ts`가 프로덕션 빌드 산출물을 실제 Chrome에 로드해 캡처에서 온 `Judging... → Accepted` 제자리 교체가 Sync History까지 도달하는지 본다. 뼈대 page에 `Acceptance Rate`·`Accepted 23,208,748/40M` 같은 일반 copy를 함께 두어 그것이 판정으로 걸리지 않는 것도 같은 실행에서 본다.

`e2e/contract.spec.ts`는 실제 `/problems/two-sum/`을 열어 판정 규칙이 실제 page 문구와 아직 맞물리는지 본다. 이 플랫폼은 공개 route라 로그인이 필요 없어 셋 중 가장 싸게 자주 돌릴 수 있다. **headed로만 된다** — headless는 Cloudflare가 막는다(2026-08-25 실측).

`e2e/full-cycle.spec.ts`가 실제 제출 → GraphQL source 조회 → 실제 commit을 실증한다(2026-08-26). commit된 code에 실행마다 붙는 nonce가 들어 있어 stale Accepted 재사용이면 그 자리에서 드러난다.

**GitHub write 계층은 이 플랫폼을 돌지 않는다.** code도 제목도 background가 GraphQL로 조회하고 그 조회에는 플랫폼 로그인 세션과 실제 제출 기록이 필요해, 합성 payload로는 `leetcode_fetch_failed`로 끝난다(2026-08-25 실측). 그 경로는 풀사이클이 실증한다.
- GraphQL metadata/Accepted Submission parsing과 submission ID 기반 deduplication
- auth/fetch 실패 normalization

## 수동 검증

[공통 수동 검증 골격](README.md#검증-공통-계약)을 먼저 실행하고 다음을 추가로 확인한다.

1. `/problems/{titleSlug}` 문제를 열고 실제로 선택 가능한 지원 언어로 Accepted를 만든다.
2. Test branch에 `leetcode/README.md`와 `leetcode/.leetcode-sync/index.json`이 solution file과 같은 commit에 포함됐는지 확인한다.
3. Wrong Answer 제출에서 sync가 없을 뿐 아니라 **source 조회 오류 toast도 나타나지 않는지** 확인한다. LeetCode만 실패 시 GraphQL 조회 경로가 있어 stale Accepted를 재사용하면 여기서 드러난다.
4. SPA navigation으로 다른 문제에 이동해 Accepted를 만들고 현재 `titleSlug`와 path만 사용되는지 확인한다.
