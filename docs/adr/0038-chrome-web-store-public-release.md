# Chrome Web Store Public 배포를 진행한다

상태: Accepted. [ADR 0010](0010-defer-chrome-web-store-to-v2.md)의 연기 결정을 supersede한다.

결정: SolveSync를 Chrome Web Store Public item으로 제출하고 심사 통과 후 사용자가 명시적으로 publish한다. 실행 계획과 제출 항목은 [Chrome Web Store 배포](../CHROME_WEB_STORE.md)를 따른다.

이유: [ADR 0010](0010-defer-chrome-web-store-to-v2.md)이 연기 근거로 든 것들이 해소됐다. Accepted-to-GitHub 흐름은 local unpacked와 GitHub Public Preview에서 검증됐고, 아이콘은 `icons/`에 있으며, `npm run package:chrome`이 `dist` 내용만 ZIP으로 만들고 필수/금지 경로를 검증한다. 인증도 사용자가 PAT를 직접 만들어 넣는 방식이 아니라 public GitHub App Device Flow로 바뀌어([ADR 0029](0029-public-github-app-device-flow-with-local-token-refresh.md)) 일반 사용자가 설치할 수 있는 형태가 됐다.

남은 것은 제품 결정이 아니라 제출 작업이다. 그런데 ADR 0010이 "연기"인 채로 남아 있으면 Store 문서가 무엇을 근거로 쓰인 것인지 알 수 없다. 결정이 바뀌었으므로 기존 ADR을 고치지 않고 새 번호로 기록한다.

트레이드오프: Store 배포는 심사, 권한 설명, Privacy 탭 답변, 반려 대응이라는 지속 비용을 만든다. Local unpacked 배포에는 없던 비용이다. 그 대신 사용자가 Developer mode 없이 설치하고 자동으로 업데이트를 받는다.

Store 배포를 시작해도 GitHub Release ZIP 경로를 즉시 없애지 않는다. 심사 결과가 나오기 전까지 현재 사용자의 설치 경로가 유일한 배포 수단이다.
