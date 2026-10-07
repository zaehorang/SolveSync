# 제품과 저장소 이름을 solve-sync로 통일한다

상태: Accepted.

결정: 제품의 사용자 표시 이름, GitHub App 이름과 public slug, GitHub 저장소 이름을 `solve-sync`로 통일한다. 새 Release ZIP은 `solve-sync-<버전>.zip`으로 만든다. 제품 문서, UI 문구, 패키지 이름, 내부 DOM·bridge 식별자와 검증 코드의 표기도 같은 이름에 맞춘다. 이미 배포된 Release ZIP 파일은 다운로드 링크 보존을 위해 그대로 둔다.

이유: 기존 제품 표기와 GitHub App의 preview 이름이 사용자 화면 및 설치 안내에 함께 나타났다. GitHub App의 원하는 slug를 사용할 수 없어 프로젝트 소유자가 2026-10-07에 `solve-sync`로 전체 브랜드를 정했다.

호환성: GitHub App의 client ID와 기존 installation은 유지한다. 확장의 storage schema, key와 사용자 Sync Repository의 파일 경로·형식은 바꾸지 않는다. SWEA bridge의 request/response source는 같은 빌드의 두 bundle에서 함께 바뀐다. 기존 preview ZIP의 App 설치 링크는 이전 slug를 가리키므로, 새 설치는 최신 배포판을 사용한다.

트레이드오프: 과거 문서의 제품명 표기도 새 이름으로 정리하지만 ADR의 당시 결정과 상태는 보존한다. Git commit history, 병합된 PR 제목, 과거 Release ZIP의 파일명은 다시 쓰지 않는다. 현재 열려 있는 로컬 작업 디렉터리는 세션 경로를 깨지 않도록 이동하지 않는다.
