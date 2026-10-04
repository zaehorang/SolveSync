# Chrome Web Store에 배포하지 않고 GitHub Release ZIP만 쓴다

상태: Accepted. [ADR 0038](0038-chrome-web-store-public-release.md)과 [ADR 0010](0010-defer-chrome-web-store-to-v2.md)을 supersede한다.

결정: SolveSync는 Chrome Web Store에 제출하지 않는다. 배포 채널은 GitHub Release에 올리는 ZIP 하나이고, 사용자는 압축을 풀어 `chrome://extensions`의 `Load unpacked`로 설치한다. ZIP은 `npm run package:chrome -- <버전>`이 만든다. Store 제출 계획 문서(`docs/CHROME_WEB_STORE.md`)는 지운다.

이유: 프로젝트 소유자가 2026-10-05에 Store 배포를 하지 않기로 결정했다. 0038은 Store Public 배포를, 0010은 그것을 v2로 미루는 것을 정했는데, 둘 다 언젠가 Store에 낸다는 전제였다. 그 전제가 사라졌으므로 두 결정 모두 현재 방침이 아니다.

트레이드오프: 사용자는 Developer mode를 켜고 직접 로드해야 하고, 자동 업데이트가 없어 새 Release를 받을 때마다 다시 로드해야 한다. 대신 Store 심사와 정책 대응, 등록 정보 유지 비용이 없다. `package:chrome` 스크립트 이름은 Store 제출용이던 시절의 것이지만 Release ZIP을 만드는 데 그대로 쓴다.
