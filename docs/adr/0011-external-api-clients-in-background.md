# 외부 API client는 background에 둔다

결정: LeetCode와 GitHub API 실행 코드는 `src/background/client` 아래에 둔다. Programmers는 현재 페이지의 Accepted Editor Snapshot 기반이므로 content Coding Platform adapter에서 수집하고, background에서는 Coding Platform source resolver가 공통 sync source로 변환한다. `src/shared`는 타입, 순수 함수, request payload builder, error normalization만 제공한다.
이유: content script와 UI가 외부 API 세부사항을 알면 권한, 보안, 장애 처리가 여러 계층으로 퍼진다. Background service worker를 orchestration owner로 두면 API 변경 영향이 좁아진다.
트레이드오프: shared 모듈에서 직접 fetch를 재사용할 수 없으며, API 호출은 background 메시징을 통해 우회해야 한다.
