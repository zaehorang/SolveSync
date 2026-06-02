# Runtime message는 typed union으로 관리한다

결정: content, popup, options, background 사이 runtime message는 `src/shared`의 discriminated union 타입으로 정의한다.
이유: Manifest V3 extension은 여러 entry point가 메시지로 결합된다. 문자열 event와 느슨한 payload만 쓰면 변경 시 깨진 메시지를 컴파일 단계에서 잡기 어렵다.
트레이드오프: 작은 UI action도 message type에 추가해야 하므로 초기 구현량이 조금 늘어난다.
