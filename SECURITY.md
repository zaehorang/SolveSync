# Security Policy

SolveSync 보안 문제는 GitHub Issue 또는 maintainer contact 경로로 제보할 수 있습니다. 공개 issue에 민감한 정보를 포함하지 마세요.

## 취약점 제보에 포함하면 좋은 내용

- 영향을 받는 SolveSync version 또는 commit
- 재현 가능한 단계
- 예상 동작과 실제 동작
- 관련 화면 또는 로그의 민감 정보 제거본

## 포함하지 말아야 할 내용

Issue, screenshot, logs, sample payload에 다음 값을 포함하지 마세요.

- GitHub PAT
- token
- cookie
- LeetCode/Programmers session 값
- private repository URL
- private solution code

실제 secret 값이 필요한 검토는 지원하지 않습니다. 제보자는 secret을 폐기하거나 재발급한 뒤 민감 정보가 제거된 재현 정보를 공유해야 합니다.

## Support Boundary

지원하는 내용:

- bug report
- docs/install question
- 공개 문서와 실제 동작이 다른 부분의 보고
- secret 없이 재현 가능한 보안 문제

지원하지 않는 내용:

- 개인 GitHub 계정 설정 대행
- PAT 값 검토
- private repository, LeetCode session, Programmers session 문제의 대리 디버깅
- 실제 token, cookie, session 값을 사용한 분석

## Security Notes

- SolveSync는 별도 backend server를 운영하지 않습니다.
- PAT와 Retry Bundle code는 Chrome extension local storage에 저장될 수 있습니다.
- GitHub write는 사용자가 선택한 Sync Repository와 Sync Branch로 제한됩니다.
- Content script는 GitHub API를 직접 호출하지 않습니다.
- LeetCode/Programmers 문제 설명 전문은 저장하지 않습니다.
