# Accepted event는 감지 즉시 전달하고 window는 억제에만 쓴다

상태: Accepted.

결정: Content script는 fresh Accepted event를 확정하는 즉시 background로 전달한다. Coalescing window는 전달을 미루는 지연 창이 아니라, 같은 render burst의 후속 signal을 무시하는 **억제 창**이다. 창은 첫 signal 시점에 열리고 `ACCEPTED_COALESCING_WINDOW_MS` 동안 유지된다. 창 안의 후속 signal은 event를 만들지 않으며 창을 연장하지도 않는다.

남는 비동기 구간은 SWEA뿐이다. SWEA는 editor code가 MAIN world bridge에서 도착해야 event를 완성할 수 있으므로([ADR 0035](0035-main-world-editor-bridge-for-swea.md)) bridge 응답까지만 기다린다.

이 구간은 두 가지로 지킨다. 전달 직전 route key 재확인([ADR 0034](0034-fresh-accepted-transition-and-immutable-event.md))은 mutation 없이 바뀐 route를 잡고, route 이동 횟수 비교는 A→B→A처럼 **되돌아온** route를 잡는다. route key만 비교하면 되돌아온 경우 key가 같아 통과한다. Controller 종료도 이동과 같게 취급해 그 뒤 도착하는 응답을 버린다.

이유: [ADR 0034](0034-fresh-accepted-transition-and-immutable-event.md)는 "동일 render burst를 최대 한 번만 전달한다"를 정했고, 구현은 그 목적을 first-event fixed-window **지연** coalescer로 달성했다. 억제라는 목적에 지연이 필요하지 않은데도 event를 창이 닫힐 때까지 content script 안에 들고 있었다.

들고 있는 동안 page가 사라지면 event가 통째로 사라진다. SWEA Accepted layer의 `확인`을 누르면 page가 언로드되는데, 사람이 그 button을 누르는 데 걸리는 시간은 창보다 짧다. 그러면 message가 background에 도달한 적이 없으므로 commit은 물론이고 Sync History 실패 기록조차 남지 않는다. 사용자는 아무 일도 일어나지 않은 화면만 본다.

같은 이유로 SPA 이동도 event를 삼켰다. 문제를 풀고 창이 닫히기 전에 다른 문제로 넘어가면 앞 문제의 풀이가 조용히 유실됐다.

## ADR 0034에서 달라지는 것

"Route key가 바뀌면 이전 route의 pending event를 폐기한다"는 규칙은 **대상이 사라져 적용되지 않는다.** 전달을 미루지 않으므로 폐기할 pending event가 없다.

이 폐기는 안전장치처럼 보였지만 실제로는 지연의 부작용이었다. Event는 fresh signal 시점에 그 route의 snapshot으로 확정되므로([ADR 0034](0034-fresh-accepted-transition-and-immutable-event.md)) 이후 사용자가 어디로 이동하든 내용이 오염되지 않는다. 앞 route에서 실제로 관찰한 Accepted를 사용자가 빨리 이동했다는 이유로 버릴 근거가 없다.

ADR 0034의 나머지는 그대로다. fresh transition 판정, signal 시점 1회 snapshot, 지연 callback에서 DOM 재읽기 금지, 전달 직전 route 재확인, SWEA bridge 응답이 route 변경 뒤 도착하면 버리는 규칙은 유지한다.

트레이드오프: 사용자가 한 route에서 Accepted를 만든 뒤 억제 창이 닫히기 전에 다른 route에서 또 Accepted를 만들면 event가 두 개 전달된다. 이전에는 앞의 하나가 폐기됐다. 두 event 모두 실제 Accepted이고 각자의 snapshot을 가지므로 이것이 맞는 동작이며, 중복 처리는 background의 Sync Deduplication Key가 막는다.

억제 창의 목적이 좁아진 만큼, 창 길이를 늘려 event를 지연시키는 방향의 변경은 이 결정을 되돌리는 것이다.
