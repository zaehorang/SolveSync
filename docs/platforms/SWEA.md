# SWEA 연동 계약

> **Description**: SW Expert Academy 전용 route, Accepted 신호, MAIN world editor bridge, 오류와 검증 계약을 정의한다. 공통 runtime과 sync 경계는 [ARCHITECTURE.md](../ARCHITECTURE.md)를 따른다.

## 관찰 기준

이 문서의 DOM 사실은 2026-08-14 로그인 상태의 실제 Chrome에서 확인한 것이다. 구현은 그 관찰을 근거로 만들었고 **실제 Accepted 제출로는 아직 확인하지 않았다.** 확인이 필요한 항목은 [미확인 전제](#미확인-전제)에 모아 두었다.

## Route와 page identity

- 풀이 페이지는 `https://swexpertacademy.com/main/solvingProblem/solvingProblem.do`이고 **모든 문제가 같은 URL을 쓰며 query string이 없다.**
- GET으로 직접 열면 anonymous error page로 redirect된다. `problemDetail.do`의 `문제 풀기` action이 POST로 여는 별도 window에서만 render된다. SPA route 전환이 아니라 새 document load다.
- 문제 식별자는 DOM의 `input#contestProbId`에만 있다. Route key는 `swea:{contestProbId}`이며 URL이 아니라 adapter가 확정한다([ADR 0036](../adr/0036-adapter-resolved-content-route-key.md)).
- `#contestProbId`를 읽지 못하면 어떤 문제인지 알 수 없으므로 unsupported page로 처리하고 event를 만들지 않는다.
- 제목은 `h3.problem_title`이고 형식은 `{문제 번호}. {제목}`이다.
- Difficulty(`D1`~`D7`)는 풀이 페이지에 없고 `problemDetail.do`에만 있다. **Difficulty를 가져오지 않는다.** 이것 때문에 추가 요청을 만들지 않는다. Catalog에는 `-`로 저장하고 Solution README에서는 column을 표시하지 않는다. Programmers와 같은 처리다.
- 지원 대상은 Problem 경로 하나다. Contest Problem, User Problem, Code Battle, 모의 테스트는 범위 밖이다.

## 식별자와 파일명

`contestProbId`와 화면의 문제 번호는 역할이 다르다.

| 값 | 출처 | 쓰임 |
| --- | --- | --- |
| `contestProbId` | `input#contestProbId` | `problemId`, route key, Accepted Source ID |
| 문제 번호 | `h3.problem_title`의 `{번호}` | `frontendId`, Solution File 이름, Solution README |

파일명은 사람이 읽는 것이고 식별은 안정성이 우선이라 나눈다. 제목이 `{번호}. {제목}` 형식이 아니어서 번호를 읽지 못하면 `frontendId`도 `contestProbId`로 되돌아간다. 이 경우 파일명이 `swea/python/AV13zZ7KAAACFAYh_숫자_카드.py`가 된다.

## Accepted 신호

- 제출은 page 전환 없이 AJAX로 수행되고 응답 JSON을 page script가 처리한다.
- 성공 시 alert layer 메시지가 `축하합니다. Pass입니다.`로 시작한다. 이 접두사로 시작하는 text만 Accepted 신호로 사용한다.
- 실패 문자열은 `채점용 input 파일로 채점한 결과 fail 입니다.`이며 제한시간 초과와 런타임 에러 문구가 여기에 붙는다. Accepted 접두사와 겹치지 않는다.
- alert layer는 `hkcommonbox`가 만드는 `.popup_layer` 안의 `.layer_alert` 구조이고 메시지는 `.txt`에 들어간다. 호출 시점에 새로 추가되는 node로 보인다.
- native browser alert 경로는 page script에서 주석 처리되어 있고 DOM layer만 사용한다.
- 그래서 [ADR 0022](../adr/0022-bounded-mutation-text-traversal-for-accepted-detection.md)의 bounded mutation text traversal만 사용하고, Programmers처럼 visibility lifecycle을 추적하는 presentation root tracker는 등록하지 않는다. Layer가 새 node 추가가 아니라 기존 node의 visibility 전환으로 나타난다면 감지되지 않는다. 이 경우의 실패는 sync가 생기지 않는 것이지 잘못된 sync가 생기는 것이 아니다.

## Accepted Editor Snapshot

Fresh Accepted를 확정한 즉시 다음 값을 한 번 읽는다.

- `contestProbId`
- 문제 번호와 제목
- 선택된 language
- `pageUrl`, `detectedAt`

Editor code만 [MAIN world bridge](#main-world-editor-bridge)에서 비동기로 온다. **code 요청도 fresh signal 시점에 보낸다.** 지연 callback에서 DOM을 다시 읽지 않으며, bridge 응답을 기다리는 동안 route key가 바뀌면 도착한 값을 버린다([ADR 0034](../adr/0034-fresh-accepted-transition-and-immutable-event.md)).

`content:accepted_detected` payload는 `codingPlatform: "swea"`, `contestProbId`, `problemNumber`, `problemTitle`, `language`, `code`, `pageUrl`, `detectedAt`을 포함한다.

## MAIN world editor bridge

Isolated world에서는 code를 읽을 수 없다. 세 경로가 모두 막혀 있다.

| 경로 | 관찰 결과 |
| --- | --- |
| `textarea#textSource.value` | 길이 0. 같은 시점 editor는 67줄이었다. CodeMirror가 textarea로 sync하지 않는다 |
| `.CodeMirror-line` | 67줄 중 27개만 존재. 가상 스크롤이라 code가 조용히 잘린다 |
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

미등록 언어는 commit하지 않고 `unsupported_language`로 기록한다.

## Accepted Source ID와 trust boundary

- SWEA는 공식 Accepted Source ID를 노출하지 않으므로 `acceptedSourceId`를 `swea:{contestProbId}:{language}:{codeHash}` 형식의 deterministic value로 만든다. Programmers와 같은 방식이다.
- MAIN world script는 page script와 같은 world에서 실행되므로 page가 bridge protocol을 관찰하고 위조 응답을 보낼 수 있다. 다만 어느 방식이든 SWEA solution source는 page가 제어하는 값이므로 신뢰 수준은 Programmers의 Accepted Editor Snapshot과 같다. [ADR 0028](../adr/0028-programmers-dom-snapshot-risk-acceptance.md)의 필수 control을 그대로 적용한다.
- 이 trust boundary는 secret이나 write destination으로 확장되지 않는다. GitHub API 호출은 background service worker에서만 수행하며 write 대상은 사용자가 선택한 Sync Repository와 Sync Branch로 제한한다.

## 오류 계약

Missing `contestProbId`/title/language와 empty code는 commit하지 않고 `swea_extract_failed`로 normalize한다. **Bridge 미주입, 응답 없음, timeout은 모두 empty code로 도착하므로 같은 코드가 된다.** Retry Bundle이 만들어지지 않으므로 UI는 retry action을 제공하지 않는다.

## Storage 영향

`CodingPlatform` union 확장은 저장된 데이터를 깨지 않는다. 기존 값(`leetcode`, `programmers`)은 그대로 유효하고 validator는 받아들이는 값이 늘어날 뿐이다. Storage schema version bump와 migration이 필요하지 않다.

## 자동 검증

- `src/content/swea.test.ts`: Accepted/실패 문구 판정, `#contestProbId` route key, 제목·언어 추출, bridge nonce/origin/timeout, controller의 immutable snapshot·coalescing·route 폐기
- `src/shared/languageRegistry.test.ts`: `swea` alias 매핑과 플랫폼별 지원 언어 집합
- `src/shared/platformPolicy.test.ts`, `src/shared/paths.test.ts`: `swea` policy와 Solution File 경로
- `src/background/sync.test.ts`: commit message, Solution Catalog/README projection, unsupported language, extract failure

대표 검증은 `npm test -- src/content/swea.test.ts src/background/sync.test.ts`로 실행하고, release 전에는 `npm run typecheck`, `npm test`, `npm run build`를 모두 실행한다.

## 미확인 전제

아래는 page script를 읽어 도출했고 **실제 Accepted 제출로 확인하지 않았다.** 어느 항목이 틀려도 결과는 "sync가 생기지 않음" 또는 "`swea_extract_failed`"이고 잘못된 commit이 생기는 경로는 없다. 그래서 구현을 먼저 하고 수동 검증에서 확인한다.

| # | 전제 | 틀렸을 때 |
| --- | --- | --- |
| 1 | Accepted 시 native dialog가 아니라 DOM alert layer가 나타난다 | 감지 안 됨 |
| 2 | 메시지 text가 `축하합니다. Pass입니다.`로 시작한다 | 감지 안 됨 |
| 3 | layer가 기존 node의 visibility 변경이 아니라 새 node 추가로 나타난다 | 감지 안 됨. presentation root tracker 필요 |
| 4 | 제출 전후로 page reload나 form navigation이 없다 | 감지 안 됨 |
| 5 | 실패 제출 문구가 Accepted 신호와 겹치지 않는다 | 잘못된 sync. **유일하게 위험한 방향이며 관찰된 두 문구는 겹치지 않는다** |
| 6 | MAIN world bridge가 화면 밖 줄을 포함해 전체 code를 반환한다 | `swea_extract_failed` |
| 7 | `.CodeMirror` expando로 instance에 도달할 수 있다 | `swea_extract_failed` |

확인 결과가 다르면 이 문서와 구현을 함께 고친다.

## 수동 검증

[공통 수동 검증](../MANUAL_VALIDATION.md)을 먼저 완료하고, 사용자가 선택한 test repository/test branch에서 다음을 실행한다.

1. SWEA에 로그인하고 `problemDetail.do`의 `문제 풀기`로 풀이 window를 연다. Toast가 뜨는지와 무관하게 **DevTools에서 `#contestProbId`, `h3.problem_title`, `select#sel_lang` 값을 먼저 기록한다.**
2. Python 3로 Accepted 제출을 만든다. Toast, Sync History와 GitHub commit이 정확히 하나인지 확인한다.
3. **commit된 code가 화면 밖으로 스크롤된 줄을 포함해 제출한 code 전체와 일치하는지 확인한다.** 최소 40줄 이상인 풀이로 확인한다.
4. 이때 alert layer가 새 node 추가였는지 기존 node의 visibility 전환이었는지 기록한다([미확인 전제](#미확인-전제) 3번).
5. 실패 제출을 만든다. 새 toast, Sync History와 commit이 없어야 한다.
6. Code를 구별 가능하게 수정한 뒤 두 번째 Accepted 제출을 만든다. 두 번째 Solution Revision commit이 정확히 하나인지 확인한다.
7. 같은 URL에서 다른 문제를 연 뒤 Accepted를 만든다. 현재 `contestProbId`와 제목으로 sync가 정확히 한 번 생성되는지 확인한다.
8. JAVA로 Accepted를 만든다. 같은 문제의 Solution README 행에 두 언어가 함께 보이는지 확인한다.
9. Extension을 재로드하지 않은 채 풀이 window를 새로 열어 bridge가 다시 주입되는지 확인한다.
