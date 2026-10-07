# Chrome Web Store에 배포하고 GitHub Release ZIP도 유지한다

상태: Accepted. [ADR 0045](0045-github-release-zip-only-distribution.md)를 supersede한다.

결정: solve-sync를 Chrome Web Store Public item으로 제출하고, 심사를 통과하면 프로젝트 소유자가 명시적으로 publish한다. GitHub Release ZIP 배포도 유지한다. 두 채널은 같은 `npm run package:chrome` 결과물을 쓴다. 제출 조건과 Release Gate는 [Chrome Web Store 배포](../CHROME_WEB_STORE.md)가 갖는다.

이유: 프로젝트 소유자가 2026-10-07에 Store 배포를 다시 진행하기로 했고, 같은 날 Chrome Web Store Developer 계정을 등록했다. 0045는 Store를 쓰지 않는다는 전제였는데 그 전제가 사라졌다. 기술적 준비 상태는 [ADR 0038](0038-chrome-web-store-public-release.md) 시점과 같다. MV3, 아이콘, ZIP 검증, public GitHub App Device Flow가 이미 갖춰져 있고, 남은 것은 문구와 권한 정리, 제출 자료, 심사다. 0038을 되살리지 않고 새 번호로 쓰는 것은 0045를 거친 결정의 이력을 덮지 않기 위해서다.

Release ZIP을 남기는 이유: 심사 결과가 나오기 전까지 Release ZIP이 유일한 설치 경로다. 출시 후에도 Store를 쓰지 않거나 Store 반영 전 빌드를 먼저 받으려는 사용자의 경로로 남긴다.

트레이드오프: 심사, 권한 설명, Privacy 탭 답변, 반려 대응, 등록 정보 유지라는 지속 비용을 다시 진다. 게시자 한도(2026-08-20부터 기본 2개)에서 한 칸을 쓴다. 대신 사용자는 Developer mode 없이 설치하고 자동으로 업데이트를 받는다. 두 채널의 버전이 어긋나지 않도록 Store 제출 버전과 Git tag, GitHub Release를 맞춰야 한다.
