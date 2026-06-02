# Content script는 별도 IIFE bundle로 빌드한다

결정: Vite main build는 background/options/popup을 만들고, content script는 `vite.content.config.ts`로 별도 IIFE bundle을 생성한다. `npm run build`는 `dist/content/index.js`에 static ESM `import`가 남지 않았는지 검증한다.
이유: MV3 background service worker는 module로 실행할 수 있지만, manifest `content_scripts`로 주입되는 script는 classic script로 로드된다. Multi-entry Vite build가 shared chunk를 만들면 content entry에 `import`가 남아 Chrome에서 `Cannot use import statement outside a module` 오류로 content script가 실행되지 않는다.
트레이드오프: build step이 둘로 나뉘고 content bundle이 shared code를 중복 포함할 수 있다. 대신 문제 페이지에서 content script가 확실히 실행되고, bundle 회귀를 build verification으로 빠르게 잡을 수 있다.
