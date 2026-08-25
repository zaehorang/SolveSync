# LeetCode 풀이 완료 badge가 Accepted로 오인될 수 있는 경로 조사 메모

> **상태**: 메커니즘은 sealed 환경에서 재현됨. **실제 환경에서 방아쇠가 당겨지는 경로는 미확인.**
>
> **용도**: 사용자가 "제출하지 않았는데 예전 풀이가 커밋됐다"고 제보할 때 먼저 확인한다. 제품 계약도 확정된 Known Issue도 아니다.

## 찾기 위한 증상 표현

- 제출한 적 없는데 LeetCode 문제의 Solution File이 새로 커밋됐다.
- 커밋된 code가 방금 쓴 것이 아니라 **예전에 통과시킨 풀이**다.
- toast는 정상적으로 떴고 Sync History에도 `synced`로 남아 있다.

## 무엇을 봤나 (2026-08-25 실측)

이미 푼 LeetCode 문제 page에는 **자식이 없는 `div` 하나에 text가 정확히 `Accepted`뿐인** 풀이 완료 badge가 있다.

```
div.text-sm.text-sd-muted-foreground  →  "Accepted"
```

`src/content/mutationText.ts`의 `collectCandidateTexts`는 한 node의 subtree에 leaf text가 **하나뿐이면** 그 text를 `allowExactAcceptedFallback: true`로 후보에 넣는다. LeetCode adapter는 그 경우 정확 일치 `Accepted`를 결과로 인정한다.

그래서 **그 모양의 node가 mutation으로 추가되면 Accepted event가 만들어진다.** sealed 하네스에서 실제 page의 class와 구조 그대로 재현했고, 제출 없이 `two-sum` sync entry가 생겼다.

## 확인된 반례 — 그냥 열어서는 일어나지 않는다

확장을 켠 Chromium(Verification Profile 복사본, GitHub 미설정)으로 이미 푼 문제 page를 열고 15초를 기다렸다. **Sync History는 0이었다.**

badge는 서버 HTML에 없고 client가 그리지만, **content script가 붙는 `document_idle`보다 먼저 그려진다.** 이미 있는 node는 mutation이 아니므로 감지되지 않는다.

## 남은 가설

badge가 **observation이 살아 있는 동안 다시 그려지는** 경로가 있으면 그때 방아쇠가 당겨진다.

1. 문제 page 안에서 SPA route 이동(다음 문제로 넘어가기). route가 바뀌면 controller가 관찰을 새로 만들고, 새 문제의 badge는 그 뒤에 그려질 수 있다.
2. tab 전환(Description ↔ Submissions ↔ Solutions)으로 badge 영역이 unmount 후 remount 되는 경우.
3. 목록·검색 overlay에서 문제를 바꾸는 경우.

2번은 tab을 눌러 봤으나 URL이 바뀌지 않아 재렌더가 일어나지 않았다. 1번과 3번은 아직 시도하지 않았다.

## 왜 판정 규칙을 좁히는 것이 답이 아닌가

**LeetCode의 진짜 Accepted 결과 text도 정확히 `Accepted`다.** Phase 1 캡처에 `Judging...` → `Accepted` 제자리 교체로 남아 있다(`e2e/fixtures/leetcode/accepted.json`).

즉 정확 일치 규칙은 **감지의 본체**이지 여유분이 아니다. 이것을 없애면 LeetCode 감지가 통째로 멈춘다. 고치려면 text가 아니라 **어느 영역에서 온 변화인가**를 구분해야 하고, 그것은 결과 panel의 안정적인 식별자를 실측해야 하는 별도 설계다.

## 피해가 제한되는 이유

같은 제출을 이미 동기화했다면 processed Sync Deduplication Key가 막는다. 실제로 드러나려면 **그 문제의 최신 Accepted 제출이 이 설치에서 한 번도 동기화된 적이 없어야** 한다 — 확장을 설치하기 전에 푼 문제가 여기 해당한다.

## 재현 시 수집할 것

- Sync History entry의 `titleSlug`, `createdAt`, `commitSha`
- 그 직전 사용자의 조작(어느 문제에서 어디로 이동했는가)
- 커밋된 code의 줄 수와 길이. **원문은 남기지 않는다.**

## 재현되면 할 것

1. sealed 재현 spec을 회귀 테스트로 승격한다. 메커니즘 재현은 이미 있다.
2. 결과 panel 식별자를 실제 page에서 실측한 뒤 판정에 영역 조건을 넣는다.
3. `docs/platforms/LEETCODE.md`의 감지 계약을 함께 고친다.
