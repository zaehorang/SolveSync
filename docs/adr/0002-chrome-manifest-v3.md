# Chrome Manifest V3

결정: Chrome Manifest V3 기반으로 확장을 구현한다.
이유: Manifest V3는 현재 Chrome extension 표준이며 service worker, content script, options page, popup page, storage, host permissions를 제공한다.
트레이드오프: Background logic은 service worker lifecycle 제약을 고려해야 하며 오래 유지되는 in-memory state에 의존하면 안 된다.
