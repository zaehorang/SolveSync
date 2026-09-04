# SWEA 연동 계약

> **Description**: SW Expert Academy 전용 route, Accepted 신호, MAIN world editor bridge, 오류와 검증 계약을 정의한다. 공통 계약은 [Coding Platform 연동 계약](README.md)을 따른다.

이 문서는 **구현 계약**이다. selector, bridge protocol, 오류 코드처럼 코드가 지켜야 할 것을 적는다. 같은 동작을 구현을 모르는 사람이 검수할 수 있게 옮긴 **사용자 관점 동작 명세**는 따로 있고, 제품 동작을 논의하거나 수동 검증 시나리오를 짤 때는 그쪽을 먼저 읽는다. 넷이다 — [정답 감지](../specs/swea/accepted-detection.md), [어느 문제를 푼 것인지 가려내기](../specs/swea/problem-identity.md), [풀이 확보](../specs/swea/solution-source.md), [풀이를 확보하지 못했을 때](../specs/swea/source-failure.md). 저장소 배치와 중복 방지는 세 사이트 공통이라 [저장 위치와 목록](../specs/common/repository-layout.md)과 [같은 풀이 중복 방지](../specs/common/duplicate-prevention.md)에 함께 있다.

## 검증 기준 문제

1206 View (`AV134DPqAA8CFAYh`). 문제당 제출 상한이 99회이므로 풀사이클 실행 횟수를 아껴 쓴다. `acceptedSourceId`에 code hash가 들어가 반복 제출 시 code를 매번 다르게 만들어야 한다.

바꾸면 이전 캡처와의 비교가 끊기므로 [`e2e/capture/baseProblems.ts`](../../e2e/capture/baseProblems.ts)와 함께 고친다.

## 관찰 기준

관찰 강도 표기는 [공통 계약의 구분](README.md#관찰과-가정을-구분한다)을 따른다. 이 문서의 DOM 사실은 2026-08-14 로그인 상태의 실제 Chrome 관찰에서 출발했고, **2026-08-18 문제 1206을 실제로 Accepted 제출해 감지부터 GitHub commit까지 전 구간을 실증했다.** 판정 결과는 [확인된 전제](#확인된-전제)에 있다.

실증에서 관찰과 달랐던 항목은 이 문서와 [ADR 0035](../adr/0035-main-world-editor-bridge-for-swea.md)에 반영했다. 아직 실제 제출로 보지 못한 항목은 그 자리에 명시한다.

## Route와 page identity

- 풀이 페이지는 `https://swexpertacademy.com/main/solvingProblem/solvingProblem.do`이고 **모든 문제가 같은 URL을 쓰며 query string이 없다.**
- `problemDetail.do`의 `문제 풀기` action이 POST로 별도 window를 연다. SPA route 전환이 아니라 새 document load다.
- **[실증 2026-08-25]** 로그인 세션이 있으면 `solvingProblem.do?contestProbId={id}`를 GET으로 직접 열어도 정상 render된다. 이전 서술("GET으로 직접 열면 anonymous error page로 redirect된다")은 **비로그인 상태의 관찰**이었다. redirect의 원인은 GET이라는 것이 아니라 세션이 없다는 것이다. 캡처 자동화가 이 경로로 진입한다.
- 문제 식별자는 DOM의 `input#contestProbId`에만 있다. Route key는 `swea:{contestProbId}`이며 URL이 아니라 adapter가 확정한다([ADR 0036](../adr/0036-adapter-resolved-content-route-key.md)).
- `#contestProbId`를 읽지 못하면 어떤 문제인지 알 수 없으므로 unsupported page로 처리하고 event를 만들지 않는다.
- 제목은 `h3.problem_title`이고 형식은 `{문제 번호}. {제목}`이다.
- Difficulty(`D1`~`D7`)는 풀이 페이지에 없고 `problemDetail.do`에만 있다. **Difficulty를 가져오지 않는다.** 이것 때문에 추가 요청을 만들지 않는다.
- 지원 대상은 Problem 경로 하나다. Contest Problem, User Problem, Code Battle, 모의 테스트는 범위 밖이다.

## 식별자와 파일명

`contestProbId`와 화면의 문제 번호는 역할이 다르다.

| 값 | 출처 | 쓰임 |
| --- | --- | --- |
| `contestProbId` | `input#contestProbId` | `problemId`, route key, Accepted Source ID |
| 문제 번호 | `h3.problem_title`의 `{번호}` | `frontendId`, Solution File 이름, Solution README |

파일명은 사람이 읽는 것이고 식별은 안정성이 우선이라 나눈다. 제목이 `{번호}. {제목}` 형식이 아니어서 번호를 읽지 못하면 `frontendId`도 `contestProbId`로 되돌아간다.

이때 **제목은 잘라내지 않고 읽은 그대로 쓴다.** 그래서 파일명은 제목에 번호가 남아 있는지에 따라 갈린다.

| 화면의 제목 | 파일명 |
| --- | --- |
| `숫자 카드` (번호 없음) | `swea/python/AV13zZ7KAAACFAYh_숫자_카드.py` |
| `1234 숫자 카드` (구분자가 `.`이 아님) | `swea/python/AV13zZ7KAAACFAYh_1234_숫자_카드.py` — 번호가 한 번 더 들어간다 |

앞의 예시만 적어 두면 뒤의 경우를 버그로 오해하게 된다.

## Accepted 신호

- 제출은 page 전환 없이 AJAX로 수행되고 응답 JSON을 page script가 처리한다.
- 성공 시 alert layer 메시지가 `축하합니다. Pass입니다.`로 시작한다. 이 접두사로 시작하는 text만 Accepted 신호로 사용한다.
- alert layer는 `hkcommonbox`가 만드는 `.popup_layer` 안의 `.layer_alert` 구조이고 메시지는 `.txt`에 들어간다.
- native browser alert 경로는 page script에서 주석 처리되어 있고 DOM layer만 사용한다.
- 그래서 [ADR 0022](../adr/0022-bounded-mutation-text-traversal-for-accepted-detection.md)의 bounded mutation text traversal만 사용하고, Programmers처럼 visibility lifecycle을 추적하는 presentation root tracker는 등록하지 않는다.

2026-08-18 실측값이다. Accepted layer는 `div.popup_layer.show` 새 node로 추가되고 그 안에 `div.layer_alert.md`가 들어간다. `.txt` node와 layer 전체의 text는 다음과 같다.

| 위치 | 실측 text |
| --- | --- |
| `.txt` | `축하합니다. Pass입니다.제출이 완료되었습니다.` |
| layer 전체 | `축하합니다. Pass입니다.제출이 완료되었습니다.확인닫기` |

layer 전체 text에는 버튼 label `확인`과 `닫기`가 뒤에 붙지만 **앞에 title node가 없어서 Accepted 접두사가 문자열 맨 앞에 온다.** `isSweaAcceptedResultText`가 접두사 일치를 쓰는 근거가 이것이다. 앞에 다른 node가 붙는 형태로 SWEA가 바꾸면 감지가 끊기므로 회귀 대상이다.

`확인`을 누르면 layer가 DOM에서 **제거된다.** 숨김 전환이 아니다.

`확인` 클릭이 page 언로드까지 일으키는지는 확인되지 않았다. 사용자 제보가 있고 [조사 메모](../investigations/SWEA_ACCEPTED_LAYER_CONFIRM_UNLOADS_PAGE.md)에 확인 절차를 적어뒀다. Accepted event는 감지 즉시 전달하므로([ADR 0037](../adr/0037-immediate-accepted-delivery-with-suppression-window.md)) 어느 쪽이든 sync는 영향받지 않는다.

실패 신호도 같은 layer 구조를 쓴다. 둘 다 2026-08-18 실측값이다.

| 실패 | layer 전체 text |
| --- | --- |
| 컴파일 오류 | `제출 오류컴파일 오류 : 오류 메세지 : ...확인닫기` |
| 채점 실패 | `오답채점용 input 파일로 채점한 결과 fail 입니다.(오답 :  10개의 테스트케이스 중 0개가 맞았습니다.)확인닫기` |

두 경우 모두 toast와 event가 생기지 않는 것을 확인했다.

**[재확인 2026-08-25]** 캡처가 위 문구를 그대로 다시 관찰했다. Accepted layer는 `축하합니다. Pass입니다.제출이 완료되었습니다.확인닫기`, 오답 layer는 `오답채점용 input 파일로 채점한 결과 fail 입니다.(오답 :  10개의 테스트케이스 중 0개가 맞았습니다.)확인닫기`로 2026-08-18 실측값과 문자 단위로 같았다. 둘 다 `childList` **node 추가**로 왔다(전제 3의 회귀 확인). 근거는 [`e2e/fixtures/swea/`](../../e2e/fixtures/swea/)다.

**Accepted layer와 실패 layer는 구조가 다르다.** 실패 layer에는 `오답`, `제출 오류` 같은 title이 메시지 앞에 붙지만 Accepted layer에는 없다.

이 비대칭이 접두사 판정을 위협하지는 않는다. `.txt` 안에서 title과 메시지는 `<br>`로 나뉜 **별도 text node**이고, `collectLeafTexts`는 개별 text node를 각각 후보로 넣기 때문이다. join한 문자열은 거기에 더해질 뿐이다. 실측한 실패 layer의 `.txt` 자식 구조는 다음과 같다.

```
.txt
├── text  "오답"
├── <br>
├── text  "채점용 input 파일로 채점한 결과 fail 입니다."
├── <br>
└── text  "(오답 :  10개의 테스트케이스 중 0개가 맞았습니다.)"
```

SWEA가 Accepted layer에도 같은 방식으로 title을 붙이면 `축하합니다. Pass입니다.`가 자기 자신의 후보로 남아 판정이 유지된다. 판정이 끊기는 것은 **title과 메시지가 하나의 text node로 합쳐질 때**뿐이다. 현재 SWEA의 작성 방식과 다르고 감지가 멈추는 방향이라 잘못된 commit은 생기지 않는다.

다만 이 내성은 후보 생성 방식에 의존한다. 후보를 join된 문자열만으로 바꾸면 조용히 사라지므로, title node가 붙은 Accepted layer 변형을 회귀 fixture에 포함한다.

제출 버튼을 누르면 채점 전에 확인용 layer(`제출 가능 횟수가 1회 감소합니다. 정말로 제출하시겠습니까?`)가 먼저 뜬다. 이것도 native dialog가 아니라 DOM layer다. 감지에는 영향이 없지만 자동화에서는 이 단계를 넘겨야 채점이 시작된다.

## 자동화가 알아야 할 것

제품 계약은 아니고 Live E2E 자동화가 이 page를 다룰 때 필요한 실측값이다. 전부 2026-08-25 로그인 상태에서 확인했다.

**세션이 브라우저 종료를 넘기지 못한다.** SWEA의 `SESSION` 쿠키는 `Expires`/`Max-Age` 없이 발급되는 진짜 session cookie다. 다른 두 플랫폼처럼 "한 번 로그인해 두고 나중에 캡처"하는 2단계 흐름이 통하지 않는다 — 로그인 창을 닫는 순간 세션이 사라진다. 그래서 로그인과 캡처를 같은 브라우저 프로세스 안에서 끝내야 한다([`e2e/capture/captureSweaSession.spec.ts`](../../e2e/capture/captureSweaSession.spec.ts)).

**제출하지 않고 코드를 실행할 수 있다.** 문제 page의 TEST 영역이다. page 안내문 그대로 *"Test는 채점을 하는 것이 아니며 정답 여부를 알려주지 않습니다"* — 제출 횟수를 쓰지 않는다. 제출 상한이 99회이므로 틀린 코드를 제출로 확인하는 것이 실제로 비싸다.

| 요소 | selector |
| --- | --- |
| 입력 | `textarea#scs_input` |
| 출력 | `div#scs_output` |
| 실행 | `id` 없는 `a`, text `Run` (`onclick="return onRun();"`) |
| 초기화 | `id` 없는 `a`, text `Clear` (`onTestReset()`) |
| 컴파일만 | `a#btnf_compile` (`onEditCompile()`) |
| 채점 제출 | `a#btnf_proposal` (`onEditSubmit()`) |

출력은 `#scs_output` 안에 `li`로 쌓이고 **최신이 위**다. 종류가 셋이다.

| class | 내용 |
| --- | --- |
| `li.message` | 진행 로그(`성공적으로 컴파일 되었습니다`, `실행이 완료되었습니다`) |
| `li.print_msg` | 프로그램 표준출력. 실제 값은 자식 `span.text`에 있다 |
| `li.error_msg` | 컴파일 오류와 Runtime error |

`span.text`의 줄바꿈은 `<br>`이라 `textContent`로 읽으면 줄이 뭉개진다. `innerText`로 읽어야 한다. 실행이 끝났는지는 `li.error_msg`가 떴거나 `li.message`에 `실행이 완료`가 떴는지로 본다 — 단순히 비어 있지 않은지만 보면 `실행을 시작합니다`가 뜬 시점에 먼저 걸린다.

**sandbox가 `import`와 `open`을 막는다.** `import sys`든 `import os`든 컴파일 오류로 거부되고, `open`은 `허용하지 않는 라이브러리가 사용되었습니다`로 거부된다. 표준입력을 읽는 수단은 `input()`뿐이다. 주석 안의 `import`는 통과하므로 문자열 스캔이 아니다.

## Accepted Editor Snapshot

Fresh Accepted를 확정한 즉시 다음 값을 한 번 읽는다.

- `contestProbId`
- 문제 번호와 제목
- 선택된 language
- `pageUrl`, `detectedAt`

Editor code만 [MAIN world bridge](#main-world-editor-bridge)에서 비동기로 온다. **code 요청도 fresh signal 시점에 보내지만, editor를 실제로 읽는 것은 MAIN world가 그 요청을 처리하는 시점이다.** 나머지 값과 달리 code는 fresh signal 시점의 값으로 고정되지 않는다. 그 사이(수 ms)에 editor가 바뀌면 바뀐 code가 commit된다. 셋 중 SWEA에만 있는 틈이다. 지연 callback에서 DOM을 다시 읽지 않으며, bridge 응답을 기다리는 동안 route key가 바뀌면 도착한 값을 버린다([ADR 0034](../adr/0034-fresh-accepted-transition-and-immutable-event.md)).

`content:accepted_detected` payload는 `codingPlatform: "swea"`, `contestProbId`, `problemNumber`, `problemTitle`, `language`, `code`, `pageUrl`, `detectedAt`을 포함한다.

## MAIN world editor bridge

Isolated world에서는 code를 읽을 수 없다. 세 경로가 모두 막혀 있다.

| 경로 | 관찰 결과 |
| --- | --- |
| `textarea#textSource.value` | 풀이 window를 열면 초기 code가 들어 있지만 이후 editor 변경이 반영되지 않는다. 2026-08-18 editor를 55줄로 바꾼 직후에도 20줄짜리 이전 값 그대로였다. 이 경로를 쓰면 **다른 시점의 code를 commit한다** |
| `.CodeMirror-line` | 2026-08-18 기준 55줄 중 27개만 존재. 가상 스크롤이라 code가 조용히 잘린다 |
| CodeMirror instance | element expando와 page global로만 접근 가능. isolated world에서 보이지 않는다 |

그래서 `world: "MAIN"` bridge가 instance의 `getValue()`를 읽어 전달한다([ADR 0035](../adr/0035-main-world-editor-bridge-for-swea.md)). Page script가 제출 시 AJAX로 보내는 값과 같은 경로다.

프로토콜은 nonce로 묶인 단발 request/response다.

- isolated content script가 nonce를 담아 요청하고 bridge는 같은 nonce로 한 번만 응답한다. Bridge는 자발적으로 값을 보내지 않는다.
- 수신 측은 `event.source === window`, `event.origin === location.origin`, 전용 message type, 요청한 nonce가 모두 일치할 때만 사용한다.
- bridge가 전달하는 값은 code string뿐이다. GitHub token, cookie, session token, Sync Repository 선택 정보는 protocol에 넣지 않는다.
- bundle은 `dist/content/sweaEditorBridge.js`이고 static ESM `import`가 없는 IIFE다. `npm run build`의 build verification이 이를 검사하고 manifest의 `world: "MAIN"` 선언도 확인한다.

## 지원 언어

`select#sel_lang` option이 셋뿐이다.

| option value | option text | supported language |
| --- | --- | --- |
| `P` | `C++14 (gcc-10.5)` | `cpp` |
| `J` | `JAVA (OpenJDK 8)` | `java` |
| `Y` | `Python 3 (PyPy 7.3.9)` | `python3` |

**언어 raw value는 option text가 아니라 option value code를 쓴다.** option text에 compiler version이 박혀 있어 SWEA가 runtime을 올리면 매핑이 깨진다. Central language registry의 `swea` alias에는 value code와 version 없는 display 표기를 함께 등록한다. Value를 읽지 못해 text로 되돌아갈 때는 괄호 부분을 떼어낸다.

**SWEA는 Swift를 제공하지 않는다.** [ADR 0009](../adr/0009-swift-solutions-outside-xcode-build-folder.md)의 Xcode build source folder 제약은 SWEA 경로에 적용될 일이 없다. 다른 플랫폼의 alias가 SWEA 경로로 새어 들어오지 않는지는 registry 테스트가 확인한다.

## Accepted Source ID와 trust boundary

- `acceptedSourceId`는 `swea:{contestProbId}:{language}:{codeHash}`다. SWEA는 공식 ID를 노출하지 않는다.
- MAIN world script는 page script와 같은 world에서 실행되므로 page가 bridge protocol을 관찰하고 위조 응답을 보낼 수 있다. 다만 어느 방식이든 SWEA solution source는 page가 제어하는 값이므로 신뢰 수준은 Programmers의 Accepted Editor Snapshot과 같다.

## 오류 계약

Missing `contestProbId`/title/language와 empty code는 commit하지 않고 `swea_extract_failed`로 normalize한다. 다만 **`contestProbId` 분기는 content 경로로 도달하지 않는다.** 그 값을 읽지 못하면 `resolveRoute`가 지원하지 않는 route로 판정해 observation 자체가 만들어지지 않기 때문이다. 실제로 이 실패를 만드는 것은 empty title, empty language와 empty code다. **Bridge 미주입, 응답 없음, timeout은 모두 empty code로 도착하므로 같은 코드가 된다.** Retry Bundle이 만들어지지 않으므로 UI는 retry action을 제공하지 않는다.

## Storage 영향

`CodingPlatform` union 확장은 저장된 데이터를 깨지 않는다. 기존 값(`leetcode`, `programmers`)은 그대로 유효하고 validator는 받아들이는 값이 늘어날 뿐이다. Storage schema version bump와 migration이 필요하지 않다.

## 자동 검증

- `src/content/swea.test.ts`: Accepted/실패 문구 판정, `#contestProbId` route key, 제목·언어 추출, bridge nonce/origin/timeout, controller의 immutable snapshot·억제 창·route 변경 시 bridge 응답 폐기
- `src/content/platforms/contract.test.ts`: 세 Coding Platform Adapter가 공통으로 지키는 계약
- `src/shared/languageRegistry.test.ts`: `swea` alias 매핑과 플랫폼별 지원 언어 집합
- `src/shared/platformPolicy.test.ts`, `src/shared/paths.test.ts`: `swea` policy와 Solution File 경로
- `src/background/sync.test.ts`: commit message, Solution Catalog/README projection, unsupported language, extract failure

대표 검증은 `npm test -- src/content/swea.test.ts src/background/sync.test.ts`로 실행한다.

`e2e/`의 검증 계층이 덮는 것은 이렇다.

- `sealed.spec.ts` + `drivers/swea.ts`: 캡처에서 온 결과 layer text가 Sync History까지 도달하고, 실패 text에서는 event가 0회다. 네트워크를 타지 않는다.
- `github-write.spec.ts`: 합성 payload가 Verification Repository의 commit이 된다.
- `contract.spec.ts`: 실제 page에 `input#contestProbId`, `h3.problem_title`, `select#sel_lang`, `.CodeMirror` host와 그 위의 editor instance가 아직 있다. **실행마다 로그인한다** — `SESSION` 쿠키가 브라우저 프로세스와 함께 사라진다.
- `full-cycle.spec.ts`: 실제 제출 → 실제 commit. **MAIN world bridge 왕복이 여기서 실증된다** — SWEA code는 bridge로만 오고, 실행마다 붙는 nonce 주석이 commit된 파일에서 확인된다(2026-08-26).
- `swea-bridge.spec.ts`: bridge가 code를 읽지 못할 때 `swea_extract_failed`로 끝나고 commit이 생기지 않는다. 네트워크를 타지 않는다.

**가상 스크롤 밖 줄도 온다.** 검증용 풀이를 123줄로 늘려 풀사이클을 돌렸더니 editor는 29줄만 렌더한 상태였고, commit된 파일은 123줄 전체였다(2026-08-26 실측, 제출 전 제출횟수 16/99). 풀사이클이 이제 매 실행마다 두 가지를 함께 단언한다 — 렌더된 `.CodeMirror-line` 수가 전체 줄 수보다 적을 것, 그리고 commit된 줄 수가 넣은 코드와 같을 것. 풀이가 짧아져 전부 렌더되면 첫 단언이 먼저 깨져 알려준다. **2026-08-31 재확인**: 같은 단언이 그대로 통과했다(전체 123줄 / 렌더 29줄, 제출 전 제출횟수 17/99).

**bridge 실패 수렴은 "editor instance가 없을 때"로 검증했다.** `e2e/swea-bridge.spec.ts`가 Sealed 뼈대(`.CodeMirror` host가 없다)에 auth와 settings를 심어 `setup_required`를 지나게 한 뒤, Sync History에 `failed` / `swea_extract_failed`가 남고 `commitSha`와 `solutionPath`가 null인 것을 본다. 재생 전에 bridge가 실제로 응답하는 것(`code: null`)을 먼저 확인하므로 bundle이 통째로 빠지면 그 확인이 먼저 깨진다.

**진짜 bridge 미주입은 이 계층에서 만들지 않는다.** 숙제로 남겨둔 것이 아니라 다른 층이 이미 막고 있어서다.

- `scripts/verify_extension_build.mjs`가 빌드마다 `content/sweaEditorBridge.js`가 `dist/`에 있고 manifest에 `world: MAIN`으로 선언됐는지 확인한다. 주입이 빠지면 런타임까지 가지 않고 빌드에서 걸린다.
- bridge가 빠지면 SWEA code를 아예 못 가져오므로 풀사이클의 nonce 단언이 실패한다.
- 미주입과 editor instance 부재는 둘 다 empty code로 수렴해 `resolveSweaSource`의 같은 분기로 들어간다. 갈라지는 로직이 없다.

그래서 여기서 실증한 조건은 "bridge는 살아 있고 editor instance가 없을 때"이고, 그것이 이 계층이 만들 수 있는 조건 전부다. 미주입 쪽 실패 경로가 같다는 것은 코드로만 확인됐다.

## 확인된 전제

구현은 page script 독해에서 나온 전제 7개 위에 세웠다. **2026-08-18 문제 1206을 실제 Accepted 제출해 7개를 모두 확인했다.**

| # | 전제 | 결과 |
| --- | --- | --- |
| 1 | Accepted 시 native dialog가 아니라 DOM alert layer가 나타난다 | 확인. `window.alert`을 가로챈 상태에서 호출이 한 번도 없었다 |
| 2 | 메시지 text가 `축하합니다. Pass입니다.`로 시작한다 | 확인. layer 전체 text의 맨 앞에 온다 |
| 3 | layer가 기존 node의 visibility 변경이 아니라 새 node 추가로 나타난다 | 확인. 첫 신호가 `childList` 추가였고 이후 attribute 변경이 뒤따른다 |
| 4 | 제출 전후로 page reload나 form navigation이 없다 | 확인. AJAX로만 처리된다 |
| 5 | 실패 제출 문구가 Accepted 신호와 겹치지 않는다 | 확인. 컴파일 오류와 채점 실패 모두 실제 제출로 확인했고 commit이 생기지 않았다 |
| 6 | MAIN world bridge가 화면 밖 줄을 포함해 전체 code를 반환한다 | 확인. 27줄만 렌더된 상태에서 55줄 전부를 돌려줬고 commit된 파일도 53줄 전체였다. 2026-08-26 풀사이클이 29줄 렌더 / 123줄 commit으로 자동 재확인한다 |
| 7 | `.CodeMirror` expando로 instance에 도달할 수 있다 | 확인 |

전제 3이 이 구현의 분기점이었다. 기존 node의 visibility 전환이었다면 ADR 0022의 bounded mutation text traversal로는 감지되지 않아 Programmers 같은 presentation root tracker가 필요했다.

Accepted가 아닌 경로도 같은 날 실측했다. 아래 네 가지 모두 toast와 event를 만들지 않았고 GitHub commit도 생기지 않았다.

| 동작 | layer text | 실제 수행 여부 |
| --- | --- | --- |
| Run | 없음. Output 영역에만 결과가 출력된다 | 실행됨(0.066s) |
| 임시저장 | `저장되었습니다.확인닫기` | 저장됨 |
| 컴파일 오류 제출 | `제출 오류...` | 채점 전 거부 |
| 오답 제출 | `오답채점용 input...` | 채점됨(0/10) |

**동작이 실제로 수행됐는지 함께 확인해야 한다.** 세션이 만료된 상태에서는 임시저장이 인증에서 튕기고 `세션이 만료되었습니다. 로그인 페이지로 이동합니다.` layer만 떠서, event가 없는 것이 감지 정확성 때문인지 요청이 실행되지 않아서인지 구분되지 않는다.

route 전환도 같은 날 확인했다. 1206 풀이 window를 닫고 같은 URL에서 1859 window를 연 뒤 Accepted를 만들었더니 현재 `contestProbId`와 제목으로 commit이 정확히 하나 생겼고, Solution README의 1206 행은 그대로 보존됐다. URL이 동일한데도 route key가 갈린다는 것을 실측으로 확인한 것이다([ADR 0036](../adr/0036-adapter-resolved-content-route-key.md)).

## 수동 검증

[공통 수동 검증 골격](README.md#검증-공통-계약)을 먼저 실행하고 다음을 추가로 확인한다. SWEA는 골격의 route 이동과 code 확보 방식이 다른 두 플랫폼과 달라 아래가 핵심이다.

기준 문제 두 개를 고정한다. 같은 문제로 반복해야 결과를 이전 실행과 비교할 수 있다. 문제를 바꾸면 이 문서의 실측값도 함께 갱신한다.

| 역할 | 문제 | `contestProbId` |
| --- | --- | --- |
| 주력 | 1206 `[S/W 문제해결 기본] 1일차 - View` | `AV134DPqAA8CFAYh` |
| route 전환 확인용 | 1859 `백만 장자 프로젝트` | `AV5LrsUaDxcDFAXc` |

두 가지를 미리 알고 시작한다.

- **같은 code를 다시 제출하면 commit이 생기지 않는다.** dedup key에 code hash가 들어가기 때문이며 정상 동작이다. 새 commit을 만들려면 marker 한 줄을 바꾼다.
- **SWEA Python 제출에서 `import sys`가 컴파일 오류로 거부된다**(2026-08-18 관찰). 검증용 풀이는 `input()`으로 작성한다.

1. `problemDetail.do`의 `문제 풀기`로 풀이 window를 연다. Toast와 무관하게 **DevTools에서 `#contestProbId`, `h3.problem_title`, `select#sel_lang` 값을 먼저 기록한다.**
2. **commit된 code가 화면 밖으로 스크롤된 줄을 포함해 제출한 code 전체와 일치하는지 확인한다.** 최소 40줄 이상인 풀이로 확인한다. isolated world에서 읽을 수 있는 값은 잘리거나 낡아 있으므로 이것이 bridge가 실제로 동작했다는 증거다.
3. Accepted layer가 새 node 추가였는지 기존 node의 visibility 전환이었는지 기록한다([확인된 전제](#확인된-전제) 3번의 회귀 확인이다).
4. **Accepted layer가 뜨자마자 곧바로 `확인`을 누른다.** toast를 기다리지 않는다. Sync History와 GitHub commit이 그대로 하나 생기는지 확인한다. page가 리로드되는지도 함께 기록한다([조사 메모](../investigations/SWEA_ACCEPTED_LAYER_CONFIRM_UNLOADS_PAGE.md)).
5. 같은 URL에서 다른 문제를 연 뒤 Accepted를 만든다. URL이 동일한데도 현재 `contestProbId`와 제목으로 sync가 정확히 한 번 생성되는지 확인한다.
6. JAVA로 Accepted를 만든다. 같은 문제의 Solution README 행에 두 언어가 함께 보이는지 확인한다.
7. Extension을 재로드하지 않은 채 풀이 window를 새로 열어 bridge가 다시 주입되는지 확인한다.
