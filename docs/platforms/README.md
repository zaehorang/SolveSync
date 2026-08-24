# Coding Platform 연동 계약

> **Description**: 모든 Coding Platform이 공통으로 지키는 연동 계약과 플랫폼 사이의 차이를 정의한다. 플랫폼별 세부는 각 플랫폼 문서를 따르고, 런타임 module 경계는 [ARCHITECTURE.md](../ARCHITECTURE.md)를 따른다.

플랫폼 문서는 **공통과 다른 것만** 적는다. 같은 문장을 세 번 쓰면 반드시 한 번 어긋나고, 실제로 어긋났다. 어느 쪽이 맞는지 판단할 근거가 없으면 이 문서가 맞다.

| 플랫폼 | 문서 |
|---|---|
| LeetCode | [LEETCODE.md](LEETCODE.md) |
| Programmers | [PROGRAMMERS.md](PROGRAMMERS.md) |
| SWEA | [SWEA.md](SWEA.md) |

## 플랫폼 사이의 차이

새 Coding Platform을 추가할 때 채워야 할 칸이 곧 이 표다.

| 항목 | LeetCode | Programmers | SWEA |
|---|---|---|---|
| Route 출처 | URL `/problems/{titleSlug}` | URL `/learn/courses/{courseId}/lessons/{lessonId}` | **DOM** `input#contestProbId`. 모든 문제가 같은 URL을 쓴다 |
| 전이 판정 | mutation 기반, 무상태 | presentation 상태기계, 유상태 | mutation 기반, 무상태 |
| 문구 판정 | 결과 text 선별 후 pattern. 정확 일치는 조건부 | **정확 일치** `정답입니다!` | **접두사 일치** `축하합니다. Pass입니다.` |
| Solution code source | GraphQL Accepted Submission detail | `textarea#code.value` | MAIN world bridge의 `getValue()` |
| `acceptedSourceId` | submission ID (플랫폼 공식) | `programmers:{lessonId}:{language}:{codeHash}` | `swea:{contestProbId}:{language}:{codeHash}` |
| Difficulty | 있음 | 없음 | 없음. 풀이 페이지에 없고 가져오지 않는다 |
| 지원 언어 | language registry 전체 | language registry 전체 | `cpp`, `java`, `python3` 셋뿐 |
| 오류 코드 | `leetcode_auth_required`, `leetcode_fetch_failed` | `programmers_extract_failed` | `swea_extract_failed` |
| Retry 가능 | fetch 실패만 가능 | 불가 | 불가 |

## Accepted 감지가 갈리는 세 층

위 표의 감지 관련 행은 성질이 서로 다른 세 층이다. 층을 뭉뚱그리면 "Programmers는 특이하다" 같은 말밖에 남지 않아서, 새 플랫폼을 붙일 때 무엇을 결정해야 하는지 알 수 없다.

### 층 1 — 무엇을 Accepted 문구로 보는가

| | 판정 |
|---|---|
| LeetCode | 결과 text 후보인지 먼저 거른 뒤 pattern 일치. 정확 일치 `Accepted`는 허용된 후보에서만 |
| Programmers | 정확히 `정답입니다!` |
| SWEA | `축하합니다. Pass입니다.` 접두사. 뒤에 붙는 부가 문구는 허용 |

LeetCode만 선별 단계가 하나 더 있다. 문제 page에 `Accepted Submissions`, `Acceptance Rate` 같은 일반 copy가 널려 있어 단어 일치만으로는 결과 text와 구분되지 않기 때문이다. 나머지 둘은 결과 문구가 고유해서 선별이 필요 없다.

### 층 2 — 언제 새로운 Accepted로 치는가

여기가 세 플랫폼을 가르는 진짜 축이다.

**LeetCode, SWEA — mutation 기반, 상태를 저장하지 않는다.** 이번 mutation의 `childList.addedNodes`에 Accepted 문구가 있거나, `characterData` 변경에서 이전 값이 Accepted가 아니었는데 지금 Accepted가 된 경우에만 signal이다. 이미 화면에 있는 Accepted는 보지 않는다.

**Programmers — presentation 상태기계, 상태를 저장한다.** 등록한 presentation root의 상태를 `inactive`와 `acceptedVisible`로 기억하고 `inactive → acceptedVisible` 전이에서만 signal을 만든다. 닫히면 `inactive`로 돌아가 re-arm한다.

이 차이의 원인은 **Programmers가 같은 result modal node를 재사용한다**는 관찰이다. node가 재사용되면 두 번째 Accepted에서 새 node 추가가 없을 수 있고, mutation 기반 판정은 그 순간 감지를 통째로 놓친다. 상태를 드는 쪽이 더 정교해서가 아니라, 안 들어도 되면 안 드는 편이 stale 판정 위험이 없어서 낫다.

### 층 3 — signal 직후 code를 어디서 가져오는가

| | source | 동기성 |
|---|---|---|
| LeetCode | content는 가져오지 않는다. background가 GraphQL로 조회 | 해당 없음 |
| Programmers | `textarea#code.value` | 동기 |
| SWEA | MAIN world bridge의 `getValue()` | **비동기** |

Accepted event 전달이 동기인지 비동기인지가 여기서 갈린다. 셋 중 SWEA만 기다리며, 나머지 둘의 동기 전달은 유지해야 하는 계약이다. 전달이 밀리면 page가 그 사이에 사라졌을 때 event가 통째로 없어진다([ADR 0037](../adr/0037-immediate-accepted-delivery-with-suppression-window.md)).

## 관찰과 가정을 구분한다

플랫폼 문서의 DOM 사실은 관찰 날짜와 함께 적되, **무엇을 보고 적었는지**도 함께 남긴다. 셋은 강도가 다르다.

| 강도 | 뜻 |
|---|---|
| **실증** | 실제 계정 제출로 그 순간의 동작을 확인했다 |
| **post-state 관찰** | 결과가 나타난 뒤의 DOM 상태만 확인했다. 나타나는 과정의 mutation 순서는 모른다 |
| **가정** | page script 독해나 유사 사례에서 추론했다. 확인한 적 없다 |

구현이 여러 경우를 동시에 대비하고 있다면 그것은 대개 어느 쪽인지 모른다는 뜻이므로, 그 사실을 문서에 적는다. 확인되지 않은 것을 확인된 것처럼 적으면 검증 계층이 그 문장을 근거로 fixture를 만들고, 틀린 fixture가 통과하는 상태가 된다.

Route 출처가 URL인가 DOM인가가 세 플랫폼을 가르는 근본 축이고 나머지 차이는 대부분 거기서 파생된다. Route key를 adapter가 확정하는 이유가 이것이다([ADR 0036](../adr/0036-adapter-resolved-content-route-key.md)).

## Accepted event 공통 계약

- 현재 DOM에 Accepted 상태가 존재한다는 사실이 아니라, adapter가 **이번 mutation에서 fresh visible Accepted transition을 확정한 경우에만** 후보를 만든다([ADR 0034](../adr/0034-fresh-accepted-transition-and-immutable-event.md)).
- Observation 범위는 mutation 안으로 제한한다([ADR 0022](../adr/0022-bounded-mutation-text-traversal-for-accepted-detection.md)).
- Route, detection time과 source data는 fresh signal 시점에 **한 번만** 캡처해 immutable event로 만든다. 지연 callback에서 DOM을 다시 읽지 않는다.
- Event는 확정 즉시 전달한다. Coalescing window는 전달을 미루는 지연 창이 아니라 같은 render burst의 후속 signal을 무시하는 **억제 창**이다([ADR 0037](../adr/0037-immediate-accepted-delivery-with-suppression-window.md)).
- 전달 직전에 route key를 다시 확인한다. Route가 바뀌면 억제 창과 route-bound adapter state를 폐기한다.
- Content script 시작 시 이미 보이는 Accepted 상태는 baseline으로만 저장하고 event를 만들지 않는다.

### Accepted event가 아닌 것

플랫폼과 무관하게 아래는 event를 만들지 않고 commit도 만들지 않는다.

- 코드 실행(Run)
- Wrong Answer, 컴파일 오류, 채점 실패
- Accepted 표시를 닫는 동작
- 이전 Accepted DOM이 남아 있는 상태의 unrelated mutation

## Sync Deduplication Key와 trust boundary

- Sync Deduplication Key는 `codingPlatform`, `acceptedSourceId`, problem identifier와 language의 조합이다.
- 플랫폼이 공식 Accepted Source ID를 노출하면 그것을 쓴다. 노출하지 않으면 `{codingPlatform}:{problemId}:{language}:{codeHash}` 형식의 deterministic value를 만든다.
- code hash가 들어가는 플랫폼에서는 **같은 code를 다시 제출하면 commit이 생기지 않는다.** 정상 동작이다.
- DOM이나 page world에서 읽은 source는 page가 제어하는 값이다. 그 residual risk는 [ADR 0028](../adr/0028-programmers-dom-snapshot-risk-acceptance.md)의 control을 적용해 수용한다.
- **이 trust boundary는 secret이나 write destination으로 확장되지 않는다.** Content message에 GitHub token, cookie와 session token을 넣지 않고, GitHub API 호출은 background service worker에서만 수행하며, write 대상은 사용자가 선택한 Sync Repository와 Sync Branch로 제한한다.

## 오류 공통 계약

- 필수 값(problem identifier, title, language)이 없거나 code가 비어 있으면 commit하지 않고 플랫폼별 extract failure로 normalize한다.
- language registry에 없는 language는 `unsupported_language`로 기록하고 commit하지 않는다.
- Difficulty를 제공하지 않는 플랫폼은 Solution Catalog에 `-`로 저장하고 Solution README에서는 Difficulty column을 표시하지 않는다.

## 플랫폼 문서에 반드시 있어야 할 것

- Route와 page identity, route key의 출처
- Accepted 신호와 그것과 헷갈리는 non-Accepted 신호
- Solution code source와 그것을 고른 이유
- `acceptedSourceId` 구성
- 플랫폼별 오류 코드
- 자동 검증 대상과 대표 실행 명령
- 수동 검증 중 **이 플랫폼에만 해당하는 절차**
- **DOM 사실은 관찰 날짜와 함께 적는다.** 외부 사이트는 예고 없이 바뀌므로 언제 본 것인지가 사실의 일부다. 실제 제출로 확인한 것과 page script 독해로 추정한 것을 구분한다.

## 새 Coding Platform을 추가할 때 갱신할 곳

SWEA를 추가할 때 사용자 대상 문서가 통째로 빠졌다. 목록이 없어서 생긴 일이므로 남긴다.

| 갱신할 곳 | 무엇을 |
|---|---|
| `manifest.json` | `host_permissions`, `content_scripts` matches |
| `src/shared/platformPolicy.ts` | root folder, Solution README/Catalog path, marker, commit prefix |
| `src/shared/languageRegistry.ts` | 플랫폼 alias와 지원 언어 집합 |
| `src/background/sync.ts` | `cleanupRepository`의 정리 대상 Coding Platform 목록 |
| `docs/platforms/{PLATFORM}.md` | 새 플랫폼 문서. 위의 "반드시 있어야 할 것" |
| `docs/platforms/README.md` | 차이 표에 열 추가 |
| `docs/PRD.md` | 지원 범위와 성공 기준 |
| `docs/ARCHITECTURE.md` | content script 주입 대상, 데이터 흐름 |
| `docs/MANUAL_VALIDATION.md` | 5절 플랫폼 검증 링크, 6절 저장소 파일 정리 |
| `docs/UI_GUIDE.md` | 번역하지 않는 고유명사 |
| `README.md` | 첫 문단, 지원 범위, 설치 사전 조건 |
| `PRIVACY.md` | 수집 데이터와 접속 대상 |
| `SECURITY.md` | session 값 목록, 지원 경계 |
| `CONTEXT.md` | 새 도메인 용어가 생겼다면 |

## 검증 공통 계약

검증은 네 계층이다. 각 계층이 **잡지 못하는 것**을 함께 적는 이유는, 적지 않으면 "테스트가 통과했다"가 무엇을 보장하는지 답할 수 없기 때문이다.

| | 계층 | 무엇을 본다 | 실제 제출 | GitHub write | 실행 | 잡지 못하는 것 |
|---|---|---|---|---|---|---|
| A | Sealed E2E | fixture page에서 감지가 Sync History까지 도달하는가 | 없음 | 없음 | 매 PR | 캡처 이후 플랫폼이 바꾼 것 |
| B | GitHub write | 합성 event가 올바른 commit·Solution README·Solution Catalog가 되는가 | 없음 | **있음** | 매 PR | 실제 인증 경로 |
| C | Contract Check | 실제 page의 DOM이 아직 Adapter의 전제와 맞는가 | 없음 | 없음 | 주기적 | **Accepted 결과 DOM.** 제출해야 나타난다 |
| D | 풀사이클 | 실제 Accepted가 실제 commit이 되는가 | **있음** | **있음** | 릴리스 전 | 자주 못 돈다. 그 사이는 A·B·C가 메운다 |

A와 B는 자격증명 유무로 갈린다. A는 secret이 없어 fork PR에서도 돌고, B는 Verification Repository 쓰기 권한만 가진 token을 쓴다. C와 D는 Verification Profile의 로그인 세션이 필요해 CI에 배선하지 않는다.

전 계층 공통으로 잡지 못하는 것이 하나 있다. **릴리스와 릴리스 사이에 플랫폼이 DOM을 바꾸면 어느 계층도 즉시 알지 못한다.** 이건 테스트가 아니라 관측의 영역이다.

플랫폼 문서의 자동 검증은 해당 플랫폼의 Vitest 파일을 가리킨다. Release 전에는 저장소 루트에서 전체를 실행한다.

```bash
npm run typecheck
npm test
npm run build
```

수동 검증은 [공통 수동 검증](../MANUAL_VALIDATION.md)을 먼저 완료한 뒤 플랫폼 문서의 절차를 실행한다. 모든 지원 언어를 실제 계정으로 반복 제출하지 않는다.

아래는 플랫폼마다 같은 골격이므로 플랫폼 문서에서 다시 적지 않는다. 플랫폼 문서에는 이 골격에서 **벗어나는 절차만** 적는다.

1. 해당 Coding Platform에 로그인하고 지원 route의 문제를 연다.
2. 지원 언어로 Accepted 제출을 만든다. Toast, Sync History와 GitHub commit이 정확히 하나인지 확인한다.
3. Run을 실행한다. 새 toast, Sync History와 commit이 없어야 한다.
4. 실패 제출(Wrong Answer, 컴파일 오류)을 만든다. 새 sync가 없어야 한다.
5. Code를 구별 가능하게 수정한 뒤 두 번째 Accepted 제출을 만든다. 두 번째 Solution Revision commit이 정확히 하나인지 확인한다.
6. 각 Solution File이 Run이나 실패 제출의 code가 아니라 해당 Accepted를 관찰한 시점의 code와 일치하는지 확인한다.
7. 각 commit이 Solution File, Solution README와 Solution Catalog를 함께 변경했는지 확인한다.
8. 다른 문제로 이동해 Accepted를 만든다. 현재 route의 식별자와 제목으로 sync가 정확히 한 번 생성되는지 확인한다.

**실제 token, cookie, session 값, private solution code와 문제 설명 전문은 screenshot, issue, fixture 또는 log에 남기지 않는다.**
