# Vanilla DOM UI

결정: Options, Popup, Toast UI는 Vanilla HTML/CSS/TypeScript로 작성한다.
이유: v1 UI는 작고 도구 성격이 강하다. UI framework를 쓰지 않으면 bundle size와 설정, runtime 복잡도를 줄일 수 있다.
트레이드오프: 상태 렌더링을 직접 관리해야 하며, UI가 커지면 이후 framework 도입을 검토할 수 있다.
