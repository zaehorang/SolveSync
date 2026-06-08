# Privacy Policy

이 문서는 GitHub Public Preview 상태의 SolveSync local unpacked Chrome extension이 처리하는 데이터와 보관 방식을 설명합니다.

## 처리하는 데이터

SolveSync는 Accepted solution sync를 위해 다음 데이터를 처리할 수 있습니다.

- GitHub PAT
- Sync Repository와 Sync Branch 설정
- Auto Sync, language preference, connection status 같은 extension 설정
- LeetCode Accepted Submission metadata와 solution code
- Programmers Accepted Editor Snapshot의 problem metadata, language, solution code
- LeetCode/Programmers problem page URL
- Sync History
- Retry Bundle
- Sync Deduplication Key와 in-flight lock 같은 중복 방지 상태

SolveSync는 LeetCode/Programmers 문제 설명 전문을 저장하지 않습니다.

## 저장 위치

SolveSync는 extension 동작에 필요한 상태를 Chrome extension local storage에 저장합니다.

PAT는 Chrome extension local storage에 저장됩니다. Retry Bundle은 GitHub commit 실패를 다시 시도하기 위해 Accepted solution code를 Chrome extension local storage에 임시 저장할 수 있습니다.

## 전송 대상

SolveSync는 다음 대상과 통신합니다.

- GitHub API: 사용자가 선택한 Sync Repository/Sync Branch에 Solution File, Solution README, Solution Catalog를 commit하기 위해 사용합니다.
- LeetCode GraphQL endpoint: 로그인된 브라우저 세션에서 Accepted Submission metadata와 solution code를 조회하기 위해 사용합니다.
- Programmers page: Accepted 직후 현재 editor의 Accepted Editor Snapshot을 읽기 위해 사용합니다.

Solution code는 사용자가 선택한 Sync Repository/Sync Branch로 GitHub sync commit을 만들기 위해서만 전송됩니다.

SolveSync는 별도 backend server를 운영하지 않으며, developer가 사용자의 PAT나 solution code를 별도 서버로 수집하지 않습니다.

## 보관과 삭제

- Sync History는 최근 20개 항목을 보관합니다.
- Retry Bundle은 최대 20개까지 보관하며, 7일이 지난 bundle은 정리됩니다.
- Retry 성공 후 해당 Retry Bundle은 삭제됩니다.
- 사용자는 Chrome extension 설정 삭제, Chrome extension storage 삭제, 또는 extension 제거를 통해 로컬 저장 데이터를 삭제할 수 있습니다.

## 공유와 판매

SolveSync는 사용자 데이터를 판매하지 않습니다.

SolveSync는 광고 목적의 데이터 사용을 하지 않습니다.

SolveSync는 sync 기능 수행에 필요한 GitHub API, LeetCode, Programmers 통신 외에 사용자 PAT, solution code, Sync History를 제3자에게 공유하지 않습니다.

## 사용자 주의사항

PAT는 최소 권한으로 생성하고, 동기화할 Sync Repository만 선택하세요. issue, screenshot, logs에 PAT, token, cookie, session 값, private solution code를 포함하지 마세요.
