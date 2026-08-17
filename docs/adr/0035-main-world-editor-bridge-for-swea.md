# SWEA editor code는 MAIN world bridge로 읽는다

결정: SWEA 풀이 페이지의 solution code는 isolated content script가 직접 DOM에서 읽지 않고, `world: "MAIN"`으로 주입한 별도 bridge script가 editor instance에서 읽어 `window.postMessage`로 전달한다. Bridge는 code string만 전달하며 nonce로 묶인 단발 request/response만 수행한다.

이유: SWEA는 기존 두 플랫폼의 추출 경로가 모두 막혀 있다. 2026-08-14 로그인 상태의 실제 Chrome에서 확인한 사실이다.

- `textarea#textSource.value.length`가 0이었다. 같은 시점 editor는 67줄을 갖고 있었다. Programmers의 `textarea#code`와 달리 CodeMirror가 textarea로 sync하지 않는다.
- `.CodeMirror-line`은 67줄 중 27개만 존재했다. 가상 스크롤이라 rendered line DOM을 source로 쓰면 code가 조용히 잘린다.
- CodeMirror instance는 element expando와 page global로만 접근할 수 있고 둘 다 isolated world에서 보이지 않는다.

Page script는 제출 시 그 instance의 `getValue()` 결과를 AJAX로 보낸다. 즉 SWEA가 채점한 것과 같은 값을 얻는 경로는 page world에 있다.

프로토콜: isolated content script가 request nonce를 담아 요청하고 bridge는 같은 nonce로 한 번만 응답한다. Bridge는 자발적으로 code를 보내지 않는다. 수신 측은 `event.source === window`, `event.origin === location.origin`, 전용 message type, 요청한 nonce가 모두 일치할 때만 값을 사용한다. Bridge protocol에는 GitHub token, cookie, session token, Sync Repository 선택 정보를 넣지 않는다.

Bundle: ADR 0023과 같은 이유로 static ESM `import`가 없는 별도 IIFE bundle로 빌드하고 build verification 대상에 포함한다. SWEA 풀이 페이지 match에만 주입한다.

보안 경계: MAIN world script는 page script와 같은 world에서 실행되므로 page가 bridge protocol을 관찰하고 위조 응답을 보낼 수 있다. 다만 어느 방식이든 SWEA solution source는 page가 제어하는 값이므로 신뢰 수준은 Programmers의 Accepted Editor Snapshot과 같다. ADR 0028의 필수 control을 그대로 적용한다. Bridge가 늘리는 것은 solution source의 신뢰 수준이 아니라 code를 온전히 읽을 수 있는 범위다.

거절한 대안: rendered line DOM에서 읽기는 가상 스크롤 때문에 code가 조용히 잘린다. 잘린 code가 commit되면 사용자가 알아채기 어려운 무결성 사고이므로 배제한다. Page script가 textarea로 sync하도록 유도하는 우회는 page 내부 동작에 의존하며 SWEA 변경에 더 취약하다. SWEA 비공식 제출 상세 API 의존은 ADR 0028이 Programmers에서 이미 거절한 방향이다.

트레이드오프: content bundle이 하나 늘고 추출이 비동기가 된다. Bridge 미주입, 응답 없음, timeout, empty code는 모두 `swea_extract_failed`로 normalize해 commit을 만들지 않는다. 실패 방향이 "잘못된 code를 commit"이 아니라 "commit하지 않음"이다.
