# Deferred Work

> **Description**: 지금 결정했지만 즉시 반영하지 않고 나중에 처리할 작업을 추적하는 문서다.

## Coding Platform naming 정렬

`Coding Platform`이 사용자가 문제를 풀고 제출하는 외부 코딩 문제 서비스의 표준 도메인 용어다.

현재 구현과 문서 일부는 아직 `platform`, `Problem Platform`, `platform policy`, `platform adapter`, `platform README` 같은 용어를 사용한다. 향후 naming 정리 작업에서는 사용자-facing 문서와 코드 식별자를 `Coding Platform`과 `Solution README` 기준으로 정렬하되, `platform`이 이미 storage schema와 runtime payload에 포함되어 있으므로 migration 또는 backward-compatible parser를 함께 설계한다.

## Solution README naming 정렬

`Solution README`가 Coding Platform별 풀이 진행 상황을 보여주는 README의 표준 도메인 용어다.

현재 구현과 문서 일부는 아직 `platform README`, `readmePath`, `readmeMarkers`, `initialReadmeTitle` 같은 용어를 사용한다. 향후 naming 정리 작업에서는 코드 타입, path policy, 테스트 이름, 문서 표현을 `Solution README` 기준으로 정렬한다.

## Sync Repository naming 정렬

`Sync Repository`와 `Sync Branch`가 SolveSync가 commit을 반영하는 GitHub 목적지의 표준 도메인 용어다.

현재 구현과 문서 일부는 아직 `Target Repository`, `Target Branch`, `selectedRepository`, `selectedBranch`, `RepositoryRef`, `BranchRef` 같은 용어를 사용한다. 향후 naming 정리 작업에서는 settings schema, runtime payload, UI copy, 테스트 이름을 `Sync Repository`와 `Sync Branch` 기준으로 정렬하되, 기존 `chrome.storage.local` 데이터 migration 또는 backward-compatible parser를 함께 설계한다.

## Solution Catalog naming 정렬

`Solution Catalog`가 Coding Platform별 풀이 목록과 진행 정보를 담는 기준 장부의 표준 도메인 용어다.

현재 구현과 대상 저장소 파일명은 아직 `index` 또는 `Platform Solution Catalog` 계열 용어를 사용한다. 향후 naming 정리 작업에서는 사용자에게 보이는 문서와 코드 식별자를 `Solution Catalog` 기준으로 정렬한다. `leetcode/.leetcode-sync/index.json`과 `programmers/.programmers-sync/index.json` 파일명은 호환성 유지 또는 명시적 migration 계획을 세운 뒤 변경한다.

## Sync Deduplication Key naming 정렬

`Sync Deduplication Key`가 같은 Accepted Submission 또는 Accepted Editor Snapshot을 중복 commit하지 않기 위해 사용하는 기준값의 표준 도메인 용어다.

현재 구현은 아직 `SubmissionIdentity`, `identity`, `processedSubmissions`, `inFlightSyncs` 같은 식별자 중심 용어를 사용한다. 향후 naming 정리 작업에서는 코드 타입, storage key, 테스트 이름, 문서 표현을 `Sync Deduplication Key` 기준으로 정렬하되, 기존 `chrome.storage.local` 데이터 migration 또는 backward-compatible parser를 함께 설계한다.

## Retry Bundle naming 정렬

`Retry Bundle`이 GitHub commit 실패를 다시 시도하기 위해 로컬에 임시 보관되는 동기화 데이터 묶음의 표준 도메인 용어다.

현재 구현과 일부 UI 문자열은 아직 `RetryPayload`, `retryPayloads`, `retryPayloadId`, `retry-payloads:read`, `payload` 같은 구현 중심 용어를 사용한다. 향후 naming 정리 작업에서는 코드 타입, runtime message, storage key, 테스트 이름, UI copy를 `Retry Bundle` 기준으로 정렬하되, 기존 `chrome.storage.local` 데이터 migration 또는 backward-compatible parser를 함께 설계한다.

## Sync History naming 정렬

`Sync History`가 Popup에 표시되는 최근 동기화 시도와 결과 목록의 표준 도메인 용어다.

현재 구현과 일부 UI 문자열은 아직 `SyncRecord`, `record`, `records`, `history:read`, `history:updated` 같은 항목 중심 또는 generic history 용어를 사용한다. 향후 naming 정리 작업에서는 코드 타입, runtime message, storage key, 테스트 이름, UI copy를 `Sync History` 기준으로 정렬하되, 기존 `chrome.storage.local` 데이터 migration 또는 backward-compatible parser를 함께 설계한다.

## Accepted Editor Snapshot naming 정렬

`Accepted Editor Snapshot`이 Programmers에서 Accepted 직후 현재 문제 페이지의 editor code와 화면 메타데이터에서 얻은 동기화 source의 표준 도메인 용어다.

현재 구현과 일부 문서/테스트 문자열은 아직 `ProgrammersAcceptedSnapshot`, `snapshot`, `editor snapshot` 같은 축약 용어를 사용한다. 향후 naming 정리 작업에서는 코드 타입, 테스트 이름, runtime payload 설명을 `Accepted Editor Snapshot` 기준으로 정렬한다.
