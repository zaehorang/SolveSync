# 보안 정책

## 지원 버전

| 버전 | 보안 지원 |
| --- | --- |
| GitHub Releases의 최신 Public Preview | 지원 |
| 이전 Public Preview | 최신 release에서 재현되는 경우에 한해 가능한 범위에서 지원 |
| 임의 fork/custom build | 해당 build maintainer에게 문의 |

SolveSync Public Preview에는 상용 SLA가 없습니다. 보안 수정은 최신 release를 기준으로 제공합니다.

## 비공개 취약점 제보

보안 취약점은 공개 GitHub Issue 대신 [GitHub Private Vulnerability Reporting](https://github.com/zaehorang/SolveSync/security/advisories/new)으로 제보하세요.

제보에 포함하면 좋은 내용:

- 영향을 받는 SolveSync release version 또는 commit
- 재현 가능한 최소 단계
- 예상 동작과 실제 동작
- 영향 범위와 가능한 악용 조건
- 관련 화면 또는 로그의 민감 정보 제거본

제보, screenshot, logs, sample payload에는 다음 실제 값을 포함하지 마세요.

- GitHub access token 또는 refresh token
- Device Flow device code
- cookie 또는 LeetCode/Programmers session 값
- private repository URL
- private solution code

실제 secret이 노출되었다면 제보 전에 해당 secret을 revoke하거나 재발급하세요. 재현에는 가짜 값이나 민감 정보가 제거된 최소 예시만 사용합니다.

## 응답과 공개 원칙

- maintainer는 제보 접수 후 7일 이내 최초 확인을 목표로 하지만 Public Preview에서는 응답 시간을 보장하지 않습니다.
- 재현과 영향 확인 후 수정 범위, 임시 완화 방법과 공개 일정을 제보자와 조율합니다.
- 사용자를 보호할 수정 release 또는 합리적인 완화 방법이 준비되기 전에는 세부 악용 절차를 공개하지 않는 coordinated disclosure를 원칙으로 합니다.
- 수정 배포 후에는 필요한 범위에서 영향을 받는 version, 영향, 대응 방법을 release note 또는 security advisory로 공개할 수 있습니다.

## 일반 Issue로 받을 수 있는 내용

- secret 없이 재현 가능한 일반 bug
- 설치·설정 질문
- 공개 문서와 실제 동작이 다른 부분
- 민감한 세부사항이 없는 보안 강화 제안

개인 GitHub 계정 설정 대행, 실제 token 검토, private repository나 Coding Platform session을 maintainer가 대신 사용하는 디버깅은 지원하지 않습니다.

## 보안 참고 사항

- SolveSync는 별도 backend server를 운영하지 않습니다.
- GitHub access/refresh token과 Retry Bundle code는 Chrome extension local storage에 저장될 수 있습니다. Device Flow pending state는 session storage에 저장됩니다.
- GitHub write는 사용자가 선택한 Sync Repository와 Sync Branch로 제한됩니다.
- Content script는 GitHub API를 직접 호출하지 않습니다.
- LeetCode/Programmers 문제 설명 전문은 저장하지 않습니다.
- `Disconnect GitHub`는 auth session만 삭제합니다. Retry Data 또는 전체 local data 삭제와 GitHub authorization/App 제거 절차는 [PRIVACY.md](PRIVACY.md)를 따릅니다.
