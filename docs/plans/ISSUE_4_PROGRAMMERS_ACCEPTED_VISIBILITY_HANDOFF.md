# Issue #4 Programmers Accepted Visibility 구현 Handoff

> **Issue**: https://github.com/zaehorang/SolveSync/issues/4
>
> **작성 기준일**: 2026-08-04
>
> **목적**: 다음 구현 에이전트가 이전 회귀를 되살리지 않고 Programmers Accepted 모달의 visibility 전환을 감지하도록 만드는 실행 계획이다.

## 1. 결과 목표

Programmers가 기존 결과 모달을 DOM에 유지한 채 숨김 상태에서 표시 상태로 바꾸더라도 SolveSync가 fresh Accepted를 정확히 한 번 감지해야 한다.

다음 결과를 모두 만족해야 한다.

- 첫 Accepted는 정확히 한 번 sync한다.
- 같은 Accepted render burst의 후속 mutation은 추가 sync하지 않는다.
- modal close, Run, Wrong Answer와 unrelated UI mutation은 sync하지 않는다.
- modal을 닫은 뒤 실제 두 번째 Accepted는 새 Solution Revision으로 정확히 한 번 sync한다.
- Programmers Accepted Editor Snapshot은 Accepted를 확정한 시점의 route, title, language와 code를 보존한다.
- SPA route가 바뀌면 이전 route의 pending event를 폐기한다.
- LeetCode Accepted 감지에는 동작 변화가 없어야 한다.

## 2. 반드시 먼저 확인할 저장소 상태

작성 시점의 기준은 다음과 같다.

- `main`: `6c0725e7e9239bf8e206a7379331381fbbad17b2`
- 현재 work branch: `fix/programmers-accepted-visibility`
- work branch는 위 `main` commit에서 생성됐으며 아직 upstream이 없다.
- 기존 fresh-transition 수정: `af185877bf16e44f0cb0da23f03101a260b5a859`
- `af18587`의 merge base는 현재 `main` HEAD다.
- `af18587`을 가리키던 `agent/fresh-accepted-transitions` branch ref는 현재 없다.
- 커밋 객체는 로컬 object database에 남아 있다.
- 현재 의도된 미커밋 변경은 root `AGENTS.md`의 Git workflow guardrail과 이 handoff 문서다.

작업 시작 전에 다음을 확인한다.

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git cat-file -t af18587
git merge-base main af18587
```

기대 결과:

- 현재 branch가 `fix/programmers-accepted-visibility`다.
- `main`과 work branch가 아직 같은 `6c0725e`를 가리킨다.
- 미커밋 변경이 `AGENTS.md`와 `docs/plans/ISSUE_4_PROGRAMMERS_ACCEPTED_VISIBILITY_HANDOFF.md` 범위뿐이다.
- `git cat-file -t af18587`이 `commit`을 출력한다.
- merge base가 `6c0725e7e9239bf8e206a7379331381fbbad17b2`다.

사용자 변경이 있거나 기준이 달라졌다면 이를 되돌리지 말고 충돌 범위를 먼저 보고한다.

## 3. 브랜치와 커밋 전략

현재 준비된 branch:

```text
fix/programmers-accepted-visibility
```

새 branch를 다시 만들지 않는다. 현재 workflow/handoff 변경을 보존한 상태에서 다음 순서로 진행한다.

```bash
git status --short --branch
git diff -- AGENTS.md
git cherry-pick af18587
```

`af18587`은 현재 미커밋 파일과 경로가 겹치지 않는다. 그래도 cherry-pick 전 status와 diff를 확인하고, 예상 밖 변경이 있으면 중단한다. Workflow/handoff 변경은 구현 작업의 첫 docs commit에 포함한다.

`af18587` 적용 후 다음 파일이 생기거나 변경됐는지 확인한다.

- `src/content/acceptedDetectionController.ts`
- `src/content/detector.ts`
- `src/content/index.ts`
- `src/content/detector.test.ts`
- `src/content/index.test.ts`
- `docs/adr/0034-fresh-accepted-transition-and-immutable-event.md`

권장 최종 commit 구성:

1. `docs: add branch workflow and issue 4 implementation handoff`
2. 기존 `af18587 fix: detect only fresh accepted transitions`
3. `docs: split coding platform integration contracts`
4. `fix: detect Programmers accepted modal visibility transitions`

테스트는 구현 전에 red 상태를 확인하되 실패하는 commit은 push하지 않는다. 최종 PR body에는 `Fixes #4`를 포함한다.

## 4. 작업 전 필수 문서

다음 순서로 읽는다.

1. `AGENTS.md`
2. `docs/PRD.md`
3. `docs/ARCHITECTURE.md`
4. `docs/adr/0022-bounded-mutation-text-traversal-for-accepted-detection.md`
5. `docs/adr/0024-coding-platform-adapters-and-shared-sync-core.md`
6. `docs/adr/0028-programmers-dom-snapshot-risk-acceptance.md`
7. `docs/adr/0034-fresh-accepted-transition-and-immutable-event.md`
8. `docs/MANUAL_VALIDATION.md`

PRD의 사용자-visible 성공 기준은 유지한다. 이번 작업은 제품 scope나 UI를 바꾸지 않는다.

## 5. Source of Truth 문서 분리

플랫폼 공통 계약과 플랫폼 전용 계약을 중복 작성하지 않는다.

새 문서:

```text
docs/platforms/LEETCODE.md
docs/platforms/PROGRAMMERS.md
```

### 5.1 `docs/ARCHITECTURE.md`에 남길 내용

- content detection controller의 공통 책임
- route-bound immutable Accepted event
- first-event fixed-window coalescing
- content → background runtime message
- Coding Platform adapter와 shared sync core의 경계
- 두 platform 문서로 가는 링크

기존 LeetCode/Programmers 상세 section은 플랫폼 문서로 옮기고 같은 설명을 양쪽에 복제하지 않는다.

### 5.2 `docs/platforms/LEETCODE.md`

LeetCode에만 해당하는 다음 내용을 둔다.

- `/problems/{titleSlug}` route 규칙
- Accepted result text와 제외 패턴
- GraphQL 우선 Accepted Submission 조회
- submission ID 기반 Accepted Source ID
- Run/Wrong Answer 이후 stale Accepted를 재사용하지 않는 규칙
- LeetCode 전용 오류와 수동 검증

### 5.3 `docs/platforms/PROGRAMMERS.md`

Programmers에만 해당하는 다음 내용을 둔다.

- `/learn/courses/{courseId}/lessons/{lessonId}` route 규칙
- 정확한 `정답입니다!` 신호
- 기존 result modal 재사용과 hidden/non-Accepted → visible Accepted 전환
- `통과`, `채점 결과`, `합계: 100.0 / 100.0` 제외 규칙
- `textarea#code.value` 기반 Accepted Editor Snapshot
- title과 language 추출
- `programmers:{lessonId}:{language}:{codeHash}` Accepted Source ID
- DOM-trusted source와 residual risk
- `programmers_extract_failed`
- Programmers 전용 자동·수동 검증

### 5.4 ADR와 validation 문서

- ADR 0034는 공통 fresh-transition 원칙과 route/snapshot/coalescing만 소유한다.
- ADR 0022는 text traversal은 계속 bounded하며, attribute 감지는 등록된 presentation root로 제한된다는 점을 명시한다.
- `docs/MANUAL_VALIDATION.md`는 공통 precondition, build, extension load, GitHub 연결과 security check를 유지하고 플랫폼별 단계는 platform 문서로 연결한다.
- `docs/PRD.md`에는 user-visible 성공 기준만 유지하며 DOM attribute나 selector를 추가하지 않는다.
- `docs/UI_GUIDE.md`, `AGENTS.md`, `README.md`는 변경하지 않는다.

## 6. 실제 DOM mutation 관찰 Gate

현재 확인된 제출 후 DOM은 다음과 같다.

```text
h4.modal-title "정답입니다!"
└─ ...
   └─ div#modal-dialog.modal.fade[aria-hidden="true"]
```

하지만 post-state만으로 attribute 순서를 추측해 구현하지 않는다. 실제 Chrome에서 다음 네 동작의 mutation sequence를 한 번 관찰한다.

1. Accepted modal 표시
2. modal close
3. Wrong Answer modal 표시
4. 두 번째 Accepted modal 표시

기록할 항목:

- visibility를 실제로 소유하는 element
- `aria-hidden`, `hidden`, `class`, `style`의 변경 순서
- title text 변경과 modal show의 순서
- Accepted와 Wrong Answer가 같은 presentation root를 재사용하는지
- 동일 동작이 하나의 MutationObserver batch인지 여러 batch인지

기록하지 않을 항목:

- solution code
- 문제 설명 전문
- cookie, session, token
- 사용자 계정 정보

테스트 fixture에는 최소 DOM structure, attribute와 mutation order만 남긴다.

이 관찰 결과가 아래 구현 가정과 다르면 코드 작성 전에 platform 문서와 테스트 설계를 먼저 수정한다.

## 7. 권장 코드 경계

`af18587` 적용 후의 공통 detector/controller를 유지하고, Programmers presentation state를 별도 모듈로 격리한다.

권장 파일:

```text
src/content/programmersAcceptedPresentation.ts
src/content/programmersAcceptedPresentation.test.ts
```

### 7.1 `src/content/detector.ts`

계속 다음 책임만 가진다.

- 짧은 result text pattern 판정
- bounded leaf traversal
- `childList.addedNodes` 기반 fresh text 감지
- non-Accepted → Accepted `characterData` 전환
- hidden candidate 제외

다음 동작을 다시 넣지 않는다.

- 일반 `mutation.target` 전체 subtree 재탐색
- document 전체 text 검색
- removed node 기반 Accepted 판정

### 7.2 `src/content/programmersAcceptedPresentation.ts`

다음 책임을 가진다.

- Programmers result presentation root 탐색/등록
- 현재 presentation이 `inactive` 또는 `acceptedVisible`인지 판정
- 관련 없는 attribute mutation 빠른 제외
- `inactive → acceptedVisible` transition 반환
- `acceptedVisible → inactive`에서 다음 event를 re-arm
- root가 교체되거나 route가 바뀔 때 baseline 재설정

권장 public shape는 다음 책임을 표현해야 한다. 정확한 이름은 기존 style에 맞춰 조정할 수 있다.

```ts
type ProgrammersAcceptedPresentationState = "inactive" | "acceptedVisible";

interface ProgrammersAcceptedPresentationTracker {
  reset(documentRef: Document): void;
  handleMutations(mutations: readonly MutationRecord[]):
    | "becameAcceptedVisible"
    | "becameInactive"
    | null;
}
```

Tracker가 DOM source, route, snapshot 또는 message 전송을 소유하지 않게 한다.

### 7.3 `src/content/acceptedDetectionController.ts`

다음 책임을 유지한다.

- 현재 route와 route key
- pending first event
- immediate Programmers Accepted Editor Snapshot
- 700ms fixed-window coalescing
- flush 전 route 재확인
- message 전송

Programmers에서는 기존 text signal과 presentation transition signal 중 하나가 fresh Accepted를 확정할 수 있다. 같은 observer batch에서 둘 다 발생해도 pending first event는 한 번만 만든다.

LeetCode에는 Programmers tracker를 적용하지 않는다.

## 8. Presentation Root와 Visibility 판정

페이지 전체의 `class`와 `style` mutation을 관찰하지 않는다. Editor와 UI mutation 양이 많고 stale Accepted 재탐색 위험이 있다.

권장 관찰 구조:

1. body/document root는 기존 `childList`와 `characterData` observer로 관찰한다.
2. 초기화 시 Programmers result presentation root를 한 번 탐색한다.
3. 찾은 presentation root에만 visibility attribute observer를 연결한다.
4. root가 나중에 추가되면 기존 `childList` 경로에서 발견해 등록한다.

Presentation root observer 후보:

```ts
{
  attributes: true,
  attributeOldValue: true,
  attributeFilter: ["aria-hidden", "hidden", "class", "style"]
}
```

Visibility 판정은 특정 class name 하나만 신뢰하지 않는다. 최소한 다음 신호를 함께 고려한다.

- root 또는 조상의 `hidden`
- root 또는 조상의 `aria-hidden="true"`
- computed `display: none`
- computed `visibility: hidden`
- presentation 안의 정확한 `정답입니다!` text

`offsetParent`는 fixed/modal element에서 신뢰하기 어려우므로 단독 기준으로 사용하지 않는다.

DOM 접근과 computed style 접근은 dependency로 주입하거나 작은 pure adapter 뒤에 두어 Vitest에서 결정적으로 테스트할 수 있게 한다.

## 9. 상태 전환 규칙

Route별 logical state:

```text
inactive
acceptedVisible
```

규칙:

```text
inactive → acceptedVisible
  fresh Accepted 1회
  route/title/language/code를 즉시 snapshot

acceptedVisible → acceptedVisible
  추가 event 없음

acceptedVisible → inactive
  event 없음
  다음 Accepted를 위해 re-arm

route 변경
  pending event 취소
  old tracker state 폐기
  새 route DOM을 baseline으로 초기화
```

Content script가 시작될 때 이미 visible Accepted가 있으면 기존 결과일 수 있으므로 baseline으로만 저장하고 emit하지 않는다.

## 10. Mutation 순서 Decision Gate

다음 순서가 실제로 가능하면 stale Accepted 오탐 위험이 있다.

```text
이전 Accepted title이 남은 modal show
→ 다음 observer batch에서 Wrong Answer title로 변경
```

실제 관찰 결과에 따라 다음 중 하나를 선택한다.

### A. 한 batch의 최종 DOM이 항상 정확한 경우

Observer callback의 current state를 즉시 판정하고 snapshot을 만든다. 추가 delay를 넣지 않는다.

### B. visible stale title이 별도 batch로 관찰되는 경우

Programmers presentation transition에만 짧은 confirmation stage를 둔다.

- 700ms coalescing과 분리한다.
- confirmation 후 즉시 snapshot을 만든다.
- confirmation 중 route가 바뀌면 폐기한다.
- Wrong Answer로 바뀌면 폐기한다.
- delay 값을 추측하지 말고 실제 mutation sequence에 맞춰 최소화한다.

어느 경우든 700ms flush callback에서 editor를 다시 읽으면 안 된다.

## 11. 테스트 우선 실행 계획

### Phase 1. `af18587` baseline 검증

```bash
npm test -- src/content/detector.test.ts src/content/index.test.ts
```

기존 fresh-transition 테스트가 통과해야 한다.

### Phase 2. 실제 DOM fixture 기반 red test

최소 fixture는 다음 특성을 포함한다.

- root는 이미 DOM에 존재한다.
- root는 hidden/`aria-hidden="true"`다.
- 내부에 `정답입니다!` heading이 이미 있다.
- child node를 추가하지 않고 attribute만 바꿔 표시한다.

현재 코드에서 이 테스트가 실패하는 것을 확인한다.

동시에 기존 stale/Run/Wrong Answer 테스트는 계속 통과해야 한다.

### Phase 3. Presentation tracker 단위 테스트

필수 case:

- hidden Accepted baseline은 event 0회
- `aria-hidden=true` → false/removed는 1회
- `hidden` removal은 1회
- class/style 기반 hidden → visible은 1회
- 여전히 hidden인 attribute 변경은 0회
- visible 상태의 추가 class/style 변경은 0회
- visible → hidden은 event 0회이며 re-arm
- unrelated element attribute 변경은 0회
- Wrong Answer presentation은 0회
- `통과`, `채점 결과`, `합계: 100.0 / 100.0`만으로는 0회
- root replacement 후 baseline이 올바르게 초기화됨

### Phase 4. Controller 통합 테스트

필수 case:

- hidden → visible Accepted는 message 1회
- text signal과 attribute signal 동시 발생도 message 1회
- 여러 visibility attribute가 연속 변경돼도 message 1회
- Accepted 직후 editor 변경 시 최초 code 유지
- Accepted → hidden → second Accepted는 총 2회
- Run/Wrong Answer 후 추가 message 없음
- route 변경 시 pending/confirmation 폐기
- 새 route Accepted는 현재 lesson ID, URL, title, language와 code 사용
- LeetCode attribute mutation은 동작 변화 없음

현재 `emits one event per real Accepted window` test는 두 Accepted 사이에 explicit hidden/re-arm transition을 넣어 실제 lifecycle과 맞춘다.

### Phase 5. 기존 detector 회귀 테스트

다음 case를 삭제하거나 expectation을 약화하지 않는다.

- stale Accepted가 있는 `childList.target` + Wrong Answer addition
- hidden Accepted node와 hidden ancestor
- removed Accepted + unrelated addition
- stale Programmers Accepted modal + Run의 `통과`
- non-Accepted → Accepted characterData만 인정
- traversal depth/text/candidate cap

## 12. 자동 검증 Gate

관련 테스트:

```bash
npm test -- src/content/detector.test.ts \
  src/content/programmersAcceptedPresentation.test.ts \
  src/content/index.test.ts
```

전체 검증:

```bash
npm run typecheck
npm test
npm run build
```

`npm run build`는 content bundle이 classic IIFE이며 static ESM import가 남지 않는지 검증해야 한다.

## 13. 실제 Chrome 수동 검증

실제 GitHub write는 사용자가 선택한 test repository/test branch에서만 수행한다.

1. 새 build로 unpacked extension을 reload한다.
2. Programmers page를 새로고침한다.
3. 첫 Accepted를 만든다.
4. toast, Sync History와 GitHub commit이 정확히 하나인지 확인한다.
5. modal을 닫는다.
6. Run을 실행하고 새 toast/history/commit이 없는지 확인한다.
7. Wrong Answer를 제출하고 새 sync가 없는지 확인한다.
8. code를 구별 가능하게 수정한 뒤 두 번째 Accepted를 만든다.
9. 두 번째 Solution Revision commit이 정확히 하나인지 확인한다.
10. 각 commit의 Solution File이 해당 Accepted 시점 code와 일치하는지 확인한다.
11. SPA로 다른 문제에 이동해 Accepted 후 현재 problem path만 사용되는지 확인한다.
12. LeetCode 대표 Accepted를 한 번 실행해 비회귀를 확인한다.

수동 검증 중 code, token, cookie, session 또는 문제 설명 전문을 screenshot/log/fixture에 남기지 않는다.

## 14. 범위 밖 작업

- Programmers 비공식 submission detail API 도입
- 일반 수동 sync action 추가
- GitHub sync/storage/retry schema 변경
- runtime message shape 변경
- 새로운 host permission 추가
- UI layout 또는 copy 변경
- README 수정
- LeetCode detector 재설계

## 15. 완료 조건

다음을 모두 만족해야 Issue #4를 닫을 수 있다.

- `af18587` fresh-transition 수정이 최종 branch에 포함됐다.
- platform 문서가 생성됐고 공통 규칙이 중복되지 않는다.
- 실제 modal attribute transition 기반 red test가 수정 후 통과한다.
- stale Accepted, Run, Wrong Answer 회귀 테스트가 통과한다.
- immutable Snapshot, coalescing과 SPA route 테스트가 통과한다.
- LeetCode 관련 테스트와 실제 대표 flow가 회귀하지 않는다.
- `npm run typecheck`, `npm test`, `npm run build`가 모두 성공한다.
- 실제 Chrome에서 first/second Accepted가 각각 정확히 한 번 sync된다.
- modal close, Run, Wrong Answer와 unrelated mutation은 sync 0회다.
- 문서와 구현이 일치한다.
- PR body에 `Fixes #4`가 포함됐다.

## 16. 구현 에이전트 보고 형식

완료 시 다음을 보고한다.

1. 실제 관찰한 Programmers mutation sequence
2. 선택한 presentation root와 visibility 판정 근거
3. stale Accepted 회귀를 막는 코드 경계
4. 추가/수정한 테스트 목록
5. 변경한 source-of-truth 문서
6. typecheck/test/build 결과
7. 실제 Chrome 수동 검증 결과 또는 아직 남은 수동 단계
8. Issue #4를 닫을 수 있는지 여부
