# Public GitHub App Device Flow와 local token refresh 사용

상태: Accepted. ADR 0006의 fine-grained PAT 결정을 supersede한다.

결정: SolveSync는 사용자가 직접 입력하는 PAT 대신 public GitHub App의 Device Flow로 로그인한다. App은 Device Flow와 expiring user access token을 활성화하고, 공개 client ID와 App slug만 extension build에 포함한다. client secret이나 별도 backend는 사용하지 않는다.

Device Flow pending state의 device code는 `chrome.storage.session`에 저장한다. 완료 후 받은 access token, refresh token, 만료 시각, 최소 account summary는 versioned `githubAuth` state로 `chrome.storage.local`에 저장한다. Public settings와 runtime 응답에는 token과 device code를 포함하지 않는다.

access token은 만료 5분 전 refresh한다. GitHub API가 401을 반환하면 강제 refresh 후 원 요청을 한 번만 재시도한다. 동시 refresh는 single-flight로 합친다. refresh 실패나 refresh token 만료 시 auth state를 삭제하고 재로그인을 요구한다.

Repository picker는 로그인 계정이 owner이고 App 설치 범위에 포함된 repository만 보여준다. App은 Metadata read와 Contents read/write 권한만 요청한다. Branch는 기존 정책대로 사용자의 명시적인 action 없이 생성하지 않는다.

이유: 소규모 tester가 token 생성·복사 없이 GitHub에서 직접 승인할 수 있고, repository access를 GitHub App 설치 범위로 제한할 수 있다. Device Flow는 local unpacked extension에서 callback server 없이 사용할 수 있으며, expiring token과 refresh rotation을 지원한다.

트레이드오프: GitHub App 등록과 tester 설치가 선행되어야 하고, access/refresh token은 OS keychain이 아닌 extension local storage에 남는다. GitHub App 설정값이 없는 build는 로그인할 수 없다. 실제 계정 승인과 App 설치는 자동 테스트만으로 완료할 수 없어 수동 검증이 필요하며, token refresh 동작은 mock 기반 자동 테스트로 검증한다.

Migration: storage v5 parser는 legacy v1-v4 settings를 읽되 `githubPat` field/value를 버리고 `login_required` 상태로 다시 저장한다. PAT를 GitHub App token으로 자동 변환하지 않는다.
