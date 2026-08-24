# Phase 1 — 실제 page에서 Accepted DOM을 캡처한다

> **선행**: 없음. Phase 2와 병렬로 진행한다.
> **산출**: `e2e/fixtures/{platform}/`의 sanitized DOM과 mutation 기록, Verification Profile 부트스트랩, 플랫폼 문서의 관찰 강도 갱신.

## 목표

세 플랫폼의 **성공 1회 + 실패 1회** Accepted 결과 DOM을 실제 제출로 캡처해 fixture로 동결한다. 이것이 Sealed E2E의 입력이 된다.

캡처가 없으면 Sealed E2E는 *우리가 상상한 DOM으로 우리 adapter를 검증하는* 순환이 된다. 통과해도 아무것도 보장하지 않는다.

## 왜 사람 손이 필요한가

로그인은 자동화하지 않는다. 자격증명을 저장소나 CI에 두지 않기 때문이다. 사람이 하는 일은 두 가지로 끝난다.

1. Verification Profile에 세 플랫폼 로그인 (1회. 이후 Phase 3·4가 같은 프로필을 쓴다)
2. 제출 승인 (**세 플랫폼 성공·실패 각 1회, 총 6회를 일괄 승인받았다**)

나머지 — 문제 page 열기, 코드 입력, 제출, DOM 회수, redaction — 는 에이전트가 한다.

## 반드시 지킬 순서 두 가지

### ① 제출 **전에** 인터셉터를 주입한다

- `MutationObserver`를 제출 전에 건다. 제출 후에 걸면 Accepted 순간의 mutation을 놓친다. 이 mutation이 "새 node 추가인가 속성 변경인가"를 판정하는 유일한 근거다.
- `window.alert`와 `window.confirm`을 가로채 **기록만 하고 통과시킨다.** 네이티브 dialog가 뜨면 브라우저 자동화 세션이 통째로 멈춘다. SWEA가 여기 해당한다.

### ② Verification Profile에 SolveSync를 로드하지 않는다

확장이 켜진 채로 실제 제출을 하면 진짜 sync가 돌아 **실사용 Sync Repository에 commit이 생기고 processed Sync Deduplication Key까지 남는다.** 그러면 나중에 같은 문제를 실제로 풀었을 때 commit이 조용히 안 생긴다.

캡처와 Contract Check는 확장 없이 뜬다. 확장이 필요한 것은 풀사이클뿐이다.

## 플랫폼별로 캡처할 것이 다르다

같은 스크립트로 셋을 캡처하면 Programmers fixture가 쓸모없어진다. 전이 판정 방식이 다르기 때문이다([세 층 설명](../../platforms/README.md#accepted-감지가-갈리는-세-층)).

### LeetCode · SWEA — mutation record 자체

- `childList.addedNodes`의 구조
- `characterData` 변경의 `oldValue` → 현재 값
- 결과 node가 새로 추가되는가, 기존 node의 text가 갈리는가

### Programmers — mutation **전후의 상태**

mutation record만 찍으면 `class` 하나 바뀐 것만 남아 재생이 불가능하다. 아래를 함께 기록한다.

- `#modal-dialog`의 `hidden`, `aria-hidden`, computed `display`/`visibility`
- `.modal-title`의 최종 text
- mutation batch 경계 (어느 변경이 같은 batch인가)

**Programmers에서 답해야 할 다섯 가지.** 현재 전부 미확인이며 구현이 두 경로를 동시에 대비하고 있다.

1. 첫 Accepted에서 `#modal-dialog`가 새로 만들어지는가, 이미 있던 node가 보이게 되는가
2. `정답입니다!`가 node 추가로 오는가, 기존 text 교체로 오는가
3. 닫은 뒤 두 번째 Accepted에서 같은 node가 재사용되는가
4. **실패 제출이 같은 root를 쓰는가** (구현이 가정하고 있다)
5. title 변경과 visibility 변경이 같은 mutation batch인가

### 실패 캡처의 의미도 다르다

- LeetCode·SWEA: 실패 text가 Accepted 판정에 안 걸린다는 것만 보면 된다.
- **Programmers: 실패 modal도 같은 root를 visible로 만든다.** title이 `정답입니다!`가 아니라서 걸러진다. 따라서 캡처에 **title text와 visibility가 둘 다** 있어야 검증이 성립한다.

## code 추출 경로도 함께 실측한다

문서의 "관찰 사실"이 틀렸던 전례가 여기서 나왔다. 존재 확인만으로는 부족하다.

| | 확인할 것 |
|---|---|
| Programmers | `textarea#code.value`가 **editor 변경 후에도 갱신되는가.** editor를 눈에 띄게 바꾼 뒤 값의 줄 수를 화면 렌더 줄 수와 비교한다 |
| SWEA | bridge `getValue()`가 가상 스크롤 밖 줄을 포함하는가 (실증됨. 재확인만) |
| LeetCode | content는 code를 읽지 않는다. 해당 없음 |

## redaction

**회수 경로 자체에 박는다.** 캡처한 뒤 지우는 방식은 쓰지 않는다. 사람이 실수할 여지를 없앤다.

- code 원문은 회수하지 않는다. 줄 수·길이·해시만 남긴다.
- cookie, session token, 계정 식별자, 문제 설명 전문은 회수하지 않는다.
- alert layer의 UI 문구는 사용자 데이터가 아니므로 보존한다.

## 작업

1. `e2e/support/profile.ts` — Verification Profile 부트스트랩. `.verification-profile/`(gitignore됨), 확장 없이 headed 실행.
2. 사람이 세 플랫폼 로그인.
3. `e2e/capture/` — 캡처 스크립트. 플랫폼별 기록 대상 분기, redaction 내장.
4. 기준 문제 확정. SWEA는 1206(`AV134DPqAA8CFAYh`). Programmers와 LeetCode는 이번에 정한다. 실사용 풀이와 겹치지 않는 문제로 고른다.
5. 정답 코드를 `e2e/fixtures/solutions/`에 둔다. SWEA Python은 `import sys`가 컴파일 오류로 거부되므로 `input()`으로 쓴다(2026-08-18 관찰).
6. 플랫폼당 성공 1회 + 실패 1회 실행.
7. `e2e/fixtures/{platform}/`에 동결하고 캡처 일자·page·조건을 기록한다.
8. 플랫폼 문서의 관찰 강도를 갱신한다. LeetCode의 "가정" 경고를 실측 표기로 교체한다.
9. 관찰이 문서와 다르면 **문서와 구현을 함께 고친다.** 이때 [SPA 복귀 후 Accepted 동기화 누락 조사 메모](../../investigations/PROGRAMMERS_ACCEPTED_SYNC_MISS_AFTER_SPA_RETURN.md)의 항목이 답해지면 그 메모도 정리한다.

## 완료 조건

- [ ] 세 플랫폼의 성공·실패 fixture가 `e2e/fixtures/{platform}/`에 있다.
- [ ] Programmers의 다섯 가지 질문에 답이 기록됐다.
- [ ] Programmers `textarea#code`의 갱신 여부가 실측됐다.
- [ ] fixture에 code 원문, token, cookie, 계정 식별자가 없다.
- [ ] 플랫폼별 기준 문제가 각 플랫폼 문서에 기록됐다.
- [ ] 세 플랫폼 문서의 관찰 강도가 갱신됐다.
- [ ] Verification Profile 세팅 절차와 세션 만료 시 재로그인 방법이 문서에 남았다.
- [ ] 캡처가 실사용 Sync Repository에 commit을 만들지 않았다 (확장 미로드 확인).
