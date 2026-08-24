# Phase 2 — Coding Platform Adapter로 나눈다

> **선행**: 없음. Phase 1과 병렬로 진행한다.
> **산출**: `src/content/platforms/`의 세 구현체, 플랫폼 분기가 없는 event controller, 공통 계약 테스트.
> **성격**: 순수 리팩터링. **동작을 바꾸지 않는다.**

## 왜 먼저 해야 하나

세 가지가 지금 구조에 묶여 있다.

1. `platform === "..."` 분기가 `acceptedDetectionController.ts`와 `detector.ts` **두 파일 12곳**에 흩어져 있다. 새 플랫폼을 붙이려면 12곳을 찾아 고쳐야 한다.
2. 공통 계약([Accepted event 공통 계약](../../platforms/README.md#accepted-event-공통-계약))이 산문으로만 있어 플랫폼마다 어긋나도 아무도 모른다. 세 구현체에 같은 테스트를 돌릴 수단이 없다.
3. **Phase 4의 병렬이 성립하지 않는다.** 세 에이전트가 같은 600줄 파일을 동시에 고치게 된다.

## 안전망의 실제 크기

기존 테스트가 내부 helper를 이름으로 직접 import한다. 공개 진입점 `startAcceptedDetectionController`를 통과하는 것은 **7곳뿐**이다(`index.test.ts` 5, `swea.test.ts` 2).

- **그 7곳이 진짜 안전망이다.** 리팩터링 내내 손대지 않는다.
- helper 단위 테스트는 삭제가 아니라 **구현체 테스트로 1:1 이동**한다. 단언 내용 그대로, import 경로만 바뀐다.

## 보존해야 할 동작

빠지면 조용히 깨진다. 이 목록이 `platforms/contract.test.ts`의 명세다.

| | 동작 | 근거 |
|---|---|---|
| 1 | 700ms 억제 창. **전달을 미루지 않는다** | ADR 0037. 미루면 SWEA `확인` 클릭으로 page가 언로드돼 event가 사라진다 |
| 2 | `routeGeneration` — A→B→A 복귀는 route key 비교만으로 못 잡는다 | 코드 주석 |
| 3 | 전달 직전 route key 재확인 | ADR 0034 |
| 4 | 종료 시 `routeGeneration += 1`로 뒤늦은 bridge 응답 무효화 | 코드 주석 |
| 5 | SWEA bridge 실패는 전부 empty code로 수렴. reject를 흘리지 않는다 | 코드 주석. 흘리면 사용자가 실패를 못 본다 |
| 6 | SWEA metadata는 fresh 시점 **동기** 캡처, code만 비동기 | ADR 0034 |
| 7 | Programmers `inactive → acceptedVisible`만 event. 닫으면 re-arm | 플랫폼 문서 |
| 8 | Programmers attribute 관찰은 등록된 root의 visibility attribute로 제한 | ADR 0022 |
| 9 | 시작 시 이미 보이는 Accepted는 baseline. event 없음 | 공통 계약 |
| 10 | bounded traversal, `MAX_RESULT_TEXT_LENGTH`, `MAX_TEXT_CANDIDATES` | ADR 0022 |
| 11 | **LeetCode·Programmers는 동기 전달** | `index.test.ts:508`이 `await` 없이 단언한다 |

11번을 가장 잘 놓친다. 인터페이스를 일률 `Promise`로 만들면 전달이 microtask로 밀리고 1번이 말한 유실이 그대로 재현된다.

## 인터페이스

```ts
// src/content/platforms/types.ts
export interface PlatformAdapter {
  readonly platform: CodingPlatform;
  resolveRoute(url: URL, doc: ContentPageDocument): PlatformRoute | null;
  createObservation(doc: AcceptedDetectionDocument, route: PlatformRoute): PlatformObservation;
}

export interface PlatformObservation {
  targets(): ObserveTarget[];
  detect(records: readonly MutationRecord[]): AcceptedSignal | null;
  buildMessage(signal: AcceptedSignal): AcceptedDetectedMessage | Promise<AcceptedDetectedMessage>;
}
```

### 설계 판단

**route key는 `PlatformRoute`의 필드다.** 별도 `routeKey()` 메서드를 두면 route와 key가 어긋날 여지가 생긴다.

**`detect`와 `buildMessage`를 합치지 않는다.** 합치면 억제된 burst에서도 SWEA bridge 요청이 나가고, Programmers는 억제 중에도 visibility lifecycle state가 전진해야 re-arm(7번)이 맞다. **판정은 항상, 조립은 억제 통과 시에만**이다.

**`retarget` 필드를 두지 않는다.** controller가 `detect()` 후 `targets()`를 다시 읽어 이전과 다르면 재관측한다. Programmers root 교체가 유일한 사용처였는데 필드 없이 처리된다.

**adapter와 observation을 합치지 않는다.** adapter는 무상태 공장, observation은 route 하나의 수명이다. route가 바뀌면 controller가 observation을 **새로 만든다.** 그래서 "route 변경 시 state 폐기"가 reset 메서드의 완전성에 기대지 않고 구조로 보장된다.

**`buildMessage`가 `Message | Promise<Message>`인 이유가 11번이다.** controller의 `resolveMaybePromise`가 값이 Promise가 아니면 동기로 호출한다. SWEA만 비동기다.

## controller 최종 형태

```ts
const signal = observation.detect(mutations);
const nextTargets = observation.targets();
if (changed(nextTargets, currentTargets)) reobserve(nextTargets);
if (signal === null || suppressed) return;

openSuppressionWindow();
const generation = routeGeneration;
resolveMaybePromise(observation.buildMessage(signal), (message) => {
  if (generation !== routeGeneration) return;   // 4번
  deliver(message, currentRouteKey);            // 3번
});
```

route가 바뀌면 `observation`을 새로 만들고 `targets()`로 재관측한다. **"이전 page가 Programmers였으면 target을 정리한다" 류의 분기 3개가 여기서 사라진다.**

## 이름 정리

역할이 바뀌거나 중복인 것들이다.

| 현재 | 이후 | 이유 |
|---|---|---|
| `acceptedDetectionController.ts` | `acceptedEventController.ts` | 감지는 Adapter가 한다. 이 파일이 소유하는 건 억제 창·route generation·전달 |
| `detector.ts` | `mutationText.ts` | 남는 것이 generic text 순회뿐 |
| `defaultTimeoutScheduler` | `scheduler.ts`로 분리 | 순회와 무관하다 |
| `ContentPageContext` | `PlatformRoute` | route다. context가 아니다 |
| `resolveContentPage` | registry의 `resolveRoute` | |
| `createContentRouteKey` | `PlatformRoute.key` 필드 | |
| `mutationListHasAccepted(m, platform)` | `mutationListMatchesText(m, predicate)` | 플랫폼 파라미터 제거. 순회는 한 곳에 남고 판정 술어만 구현체가 넘긴다 |
| `AcceptedDetectionPlatform` | **삭제.** `CodingPlatform` 사용 | `types.ts:5`와 완전히 같은 정의의 중복 |
| `programmersAcceptedPresentation.ts` | `platforms/programmers.ts`에 흡수 | 구현체가 생기면 분리 이유가 없다 |
| `ProgrammersAcceptedEditorSnapshot`, `SweaAcceptedEditorSnapshotMetadata` | 각 구현체의 `AcceptedSignal` | |

`requestSweaEditorCode`가 `AcceptedDetectionControllerOptions`에서 사라지고 SWEA adapter의 생성자 의존으로 내려간다. **이 옵션이 없어지는 것이 "controller가 SWEA를 모르게 됐다"의 기계적 증거다.**

## 단계와 게이트

각 단계 끝에서 `npm run typecheck && npm test && npm run build`가 통과해야 다음으로 간다.

| | 내용 | 게이트 |
|---|---|---|
| 2a | `types.ts` + `index.ts`(registry). 구현체 없음 | typecheck |
| 2b | LeetCode 구현체. controller는 기존 분기 유지, LeetCode 경로만 우회 | 기존 테스트 전체 통과 |
| 2c | SWEA 구현체. `resolveMaybePromise` 확정 | 진입점 경유 7개 **무변경** 통과 |
| 2d | Programmers 구현체. presentation 흡수, `targets()` 교체 경로 | 동일 |
| 2e | controller 분기 전면 제거, `requestSweaEditorCode` 옵션 삭제, `index.ts` 배선 변경 | `grep -c 'platform === ' src/content/*.ts` → **0** |
| 2f | helper 테스트 이동 + `contract.test.ts` 신규 | 보존 목록 11개 전부 커버 |

**플랫폼별로 쪼개는 이유**는 한 번에 갈아엎으면 실패했을 때 어느 플랫폼 탓인지 모르기 때문이다. 2b~2d 동안 나머지 플랫폼은 기존 경로로 계속 돈다.

2e의 grep이 완료 판정이다. 숫자가 남아 있으면 Adapter 경계가 새고 있는 것이다.

## 공통 계약 테스트

이 리팩터링의 최대 수확이다. 세 구현체에 같은 테스트를 돌려 **세 플랫폼이 처음으로 대칭 검증된다.**

```ts
for (const makeAdapter of ALL_ADAPTERS) {
  describe(makeAdapter.name, () => {
    it("시작 시 이미 보이는 Accepted는 baseline으로만 남고 signal이 없다");
    it("이전 Accepted DOM이 남은 unrelated mutation에서 signal이 없다");
    it("Run과 실패 제출에서 signal이 없다");
    it("route가 바뀌면 관측 state를 폐기한다");
    it("buildMessage가 DOM을 다시 읽지 않는다");
  });
}
```

## 완료 조건

- [ ] 세 구현체가 `src/content/platforms/`에 있고 registry가 URL로 해석한다.
- [ ] `grep -c 'platform === ' src/content/*.ts`가 0이다.
- [ ] `AcceptedDetectionControllerOptions`에 `requestSweaEditorCode`가 없다.
- [ ] 진입점 경유 테스트 7개가 **변경 없이** 통과한다.
- [ ] 보존 목록 11개가 `contract.test.ts` 또는 구현체 테스트로 덮인다.
- [ ] 11번(동기 전달)이 테스트로 고정된다.
- [ ] `docs/ARCHITECTURE.md`와 `src/content/CLAUDE.md`의 구조 서술이 실제와 맞는다.
