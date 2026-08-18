# SWEA Accepted layer `확인` 클릭이 page를 언로드하는지 조사 메모

> **상태**: 사용자 제보만 있고 실제 Chrome에서 재현 확인되지 않음
>
> **용도**: "Accepted 팝업에서 `확인`을 눌렀더니 sync가 끊겼다"는 제보를 받았을 때 무엇을 확인할지 정리한다. 제품 계약이나 확정된 Known Issue가 아니다.

## 배경

`docs/platforms/SWEA.md`는 2026-08-18 실측으로 두 가지를 기록했다.

- `확인`을 누르면 alert layer가 DOM에서 제거된다.
- [확인된 전제](../platforms/SWEA.md#확인된-전제) 4번: 제출 전후로 page reload나 form navigation이 없다.

사용자는 "정답 팝업 뒤 커밋이 되는 동안 `확인`을 누르면 화면이 리로드되는 것 같다"고 제보했다. 두 관찰이 어긋난다. 4번 전제는 **제출 시점**을 다룬 것이고 `확인` 클릭 이후는 다루지 않았으므로, 두 관찰이 동시에 참일 수도 있다.

## 재현 시 확인할 것

1. `확인` 클릭 직후 `document`가 교체되는가. `window.addEventListener("pagehide", ...)`가 발화하는지 본다.
2. 발화한다면 navigation인지 reload인지. `performance.getEntriesByType("navigation")[0].type`을 새 문서에서 읽는다.
3. layer가 제거만 되는 경로와 언로드까지 가는 경로가 조건에 따라 갈리는가. 문제 종류, 제출 횟수 소진 여부, 세션 상태를 함께 기록한다.

## 이 조사와 무관하게 이미 고친 것

제보의 실제 피해는 "sync가 시작조차 하지 않는다"였고, 그 원인은 `확인`이 무엇을 하는지와 별개였다. Content script가 Accepted event를 coalescing 창이 닫힐 때까지 들고 있었기 때문에, 그 창 안에서 page가 사라지면 message가 background에 도달한 적이 없었다.

[ADR 0037](../adr/0037-immediate-accepted-delivery-with-suppression-window.md)로 감지 즉시 전달하도록 바꿨다. **이제 `확인`이 언로드를 일으키든 아니든 event는 이미 전달된 뒤다.** 남는 노출 구간은 SWEA bridge 왕복(통상 수 ms)뿐이다.

그래서 이 note의 목적은 sync 정확성이 아니라 `docs/platforms/SWEA.md`의 DOM 사실을 맞추는 것이다.

## 승격 조건

`확인` 클릭이 언로드를 일으키는 것이 실측되면 `docs/platforms/SWEA.md`의 해당 문장과 확인된 전제 4번의 범위를 갱신하고 이 note를 제거한다. 언로드가 없는 것으로 확인되어도 마찬가지로 기록을 명확히 한 뒤 제거한다.

## 안전 범위

수집 대상은 navigation type, event 발화 여부, layer DOM 구조뿐이다. solution code, 세션 token, 계정 식별자는 기록하지 않는다.
