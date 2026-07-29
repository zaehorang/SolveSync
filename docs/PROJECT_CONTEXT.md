# SolveSync Project Context

> **Last verified**: 2026-07-29
> **Purpose**: 새 개발자와 coding agent가 현재 제품 단계, 시스템 경계, 중요한 결정과 문서 위치를 빠르게 이해하기 위한 orientation 문서다.

이 문서는 source of truth를 대체하지 않는다. 제품 요구사항은 [PRD](PRD.md), 런타임 계약은 [Architecture](ARCHITECTURE.md), 용어는 [Context](../CONTEXT.md), 설계 결정은 [ADR](adr/)을 따른다.

## 한눈에 보기

SolveSync는 LeetCode와 Programmers의 Accepted 풀이를 사용자가 선택한 GitHub Sync Repository와 Sync Branch로 동기화하는 개인용 Chrome extension이다. 사용자가 풀이 code를 복사하고 파일·README·catalog를 직접 갱신하는 반복 작업을 줄이는 것이 목적이다.

현재 제품은 Chrome Web Store가 아닌 GitHub Release ZIP으로 배포하는 local unpacked Public Preview다. 별도 backend는 없으며 Accepted 감지, GitHub 인증, sync orchestration과 로컬 상태 관리는 모두 Chrome extension runtime 안에서 수행한다.

## 현재 기준선

| 항목 | 현재 상태 |
| --- | --- |
| 배포 대상 | `0.1.0-preview.2` release candidate |
| Chrome manifest | MV3, `version: 0.1.0.2`, Chrome 102 이상 |
| 배포 채널 | GitHub Release의 unpacked-extension ZIP |
| Coding Platform | LeetCode, Programmers |
| 지원 언어 | Swift, Python3, Java, C++, JavaScript, TypeScript, Kotlin, Go, Rust |
| 인증 | Public GitHub App Device Flow와 expiring user token |
| 저장소 schema | Chrome extension storage v5 |
| Solution Catalog | Coding Platform별 v4 |
| 빌드 도구 | Node.js 22.12.0, npm 10.9.0, Vite 8.0.16 |
| 자동 검증 | Typecheck, Vitest, production build, content IIFE, deterministic ZIP, dependency audit |

`0.1.0-preview.2`가 실제 공개 release가 되는 시점은 `v0.1.0-preview.2` tag의 release workflow가 draft prerelease를 생성하고 maintainer가 검토한 뒤다. 이 문서의 버전 표시는 repository source 기준이며 GitHub의 공개 release 상태를 대신하지 않는다.

## 제품 경계

현재 포함:

- Coding Platform 문제 페이지에서 Accepted 감지
- LeetCode Accepted Submission API 조회
- Programmers Accepted Editor Snapshot 추출
- GitHub Device Flow, App 설치, Sync Repository/Sync Branch 선택
- 사용자의 명시적 action에 의한 branch 생성
- Auto Sync, Sync History, retry 가능한 실패의 Retry
- Solution File, Solution README, Solution Catalog를 하나의 GitHub commit으로 반영
- Retry Data와 전체 local data 삭제

현재 제외:

- Chrome Web Store 배포와 자동 업데이트
- Organization/team repository와 collaborator workflow
- 일반 수동 sync
- 여러 GitHub 계정 동시 관리
- LeetCode·Programmers 문제 설명 전문 저장
- 별도 cloud backend
- Programmers 비공식 제출 상세 API

## 핵심 사용자 흐름

```text
Options에서 GitHub 로그인/App 설치
→ Sync Repository와 Sync Branch 선택
→ read-only connection test
→ Auto Sync 활성화
→ Coding Platform에서 Accepted
→ content script가 Accepted 신호와 최소 metadata 전달
→ background가 source와 Sync Deduplication Key 확정
→ 입력 제한, setup, duplicate, in-flight lock 확인
→ GitHub Git Data API로 Solution File/README/Catalog commit
→ 성공 후에만 processed key 기록
→ Toast와 Popup Sync History에 결과 표시
```

LeetCode는 content script가 전달한 `titleSlug`를 기준으로 background가 Accepted Submission을 다시 조회한다. Programmers는 공식 제출 상세 API를 전제로 하지 않고 Accepted 직후 현재 editor의 snapshot을 source로 사용한다.

## 런타임 책임

| 영역 | 책임 | 하지 않는 일 |
| --- | --- | --- |
| Content | Accepted 관찰, Programmers snapshot, Toast, locale 조회 | GitHub API 호출, token/storage 직접 접근 |
| Background | 인증, source validation, sync orchestration, storage, GitHub write, cleanup | 장기 in-memory state를 source of truth로 사용 |
| Options | GitHub 연결, repository/branch 설정, connection test, local data 삭제 | solution sync orchestration |
| Popup | Auto Sync 제어, 최근 history, failure detail, Retry | 일반 수동 sync |
| Shared | 타입, message validator, 입력 제한, path/language, Catalog/README, error normalization | UI나 외부 API side effect |

Background runtime은 sender의 extension ID, 실제 URL과 surface별 allowlist를 확인한다. Content는 전체 settings 대신 locale preference만 읽을 수 있다. `chrome.storage.local`은 `TRUSTED_CONTEXTS`로 제한하고 storage를 사용하는 handler는 해당 초기화가 끝날 때까지 기다린다.

## 상태와 데이터 수명주기

- `settings`: 선택한 Sync Repository/Sync Branch, Auto Sync, UI language, connection 상태.
- `githubAuth`: access/refresh token과 최소 account summary. public runtime response에 포함하지 않는다.
- `processedSyncDeduplicationKeys`: GitHub commit 성공 후에만 추가한다.
- `syncDeduplicationKeyLocks`: 중복 실행을 막으며 10분 TTL을 가진다.
- `syncHistory`: 최근 20개 결과.
- `retryBundles`: retry 가능한 실패만 저장하며 solution code를 포함할 수 있다. 최대 20개, 생성 후 최대 7일.
- Device Flow pending state: `chrome.storage.session`에만 저장한다.

만료 Retry Bundle은 service worker boot, install/update, Chrome startup, 기존 sync/retry 접근과 하루 주기 `retry-bundle-prune` alarm에서 정리한다.

Options의 `Delete Retry Data`는 Retry Bundle과 history의 retry 참조만 제거한다. `Delete all local data`는 pending Device Flow를 포함한 extension local/session state를 초기화한다. 두 action 모두 GitHub App 설치나 이미 생성된 GitHub commit을 삭제하지 않는다.

## 보안 경계

- GitHub client secret, 실제 사용자 token, cookie와 session 값을 source·fixture·문서에 넣지 않는다.
- Content message와 public settings에는 GitHub token이나 Device Flow device code를 포함하지 않는다.
- 외부 write는 background service worker만 수행하며 대상은 사용자가 선택한 Sync Repository/Sync Branch로 제한한다.
- Solution code는 UTF-8 기준 262,144 bytes까지 허용한다. 공백뿐인 code와 초과 code는 commit이나 Retry Bundle 생성 전에 거부한다.
- Accepted metadata 제한은 title 300 Unicode code points, platform ID/title slug 128자, language 64자, URL 2,048자다.
- Solution README의 외부 metadata는 Markdown/HTML 구조를 만들지 못하도록 escape한다.
- GitHub commit 성공 전에는 processed Sync Deduplication Key를 기록하지 않는다.
- branch는 사용자가 명시적으로 Create action을 실행한 경우에만 만든다.

## 배포와 릴리스

Production ZIP에는 compiled extension, `LICENSE`, `THIRD_PARTY_NOTICES.txt`만 포함하며 `.env`, source, docs, source map과 build cache는 포함하지 않는다. ZIP 파일 순서와 metadata를 고정해 같은 source·toolchain에서 같은 SHA-256이 나오도록 만든다.

CI는 pull request와 `main` push에서 typecheck, tests, dependency audit, build와 ZIP 재현성을 검사한다. `v*` tag release workflow는 tag/package/manifest 버전을 검증하고 checksum과 build provenance attestation이 포함된 draft prerelease를 만든다.

Public Preview 수동 release gate는 [Manual Validation](MANUAL_VALIDATION.md)을 따른다. Chrome Web Store는 [ADR 0010](adr/0010-defer-chrome-web-store-to-v2.md)에 따라 후속 범위다.

## 핵심 설계 결정

| 결정 | 근거 |
| --- | --- |
| MV3 service worker와 storage 기반 복구 | [ADR 0002](adr/0002-chrome-manifest-v3.md) |
| Public GitHub App Device Flow와 token refresh | [ADR 0029](adr/0029-public-github-app-device-flow-with-local-token-refresh.md) |
| Programmers Accepted Editor Snapshot risk 수용 | [ADR 0028](adr/0028-programmers-dom-snapshot-risk-acceptance.md) |
| Trusted storage와 sender-scoped runtime ingress | [ADR 0031](adr/0031-trusted-storage-and-sender-scoped-runtime-ingress.md) |
| Alarm 기반 Retry retention과 명시적 data deletion | [ADR 0032](adr/0032-alarm-backed-retry-retention-and-explicit-local-deletion.md) |
| 재현 가능한 GitHub Preview release | [ADR 0033](adr/0033-reproducible-github-preview-release-pipeline.md) |

## 유지해야 하는 불변조건

1. Processed Sync Deduplication Key는 GitHub commit 성공 후에만 기록한다.
2. 같은 Sync Deduplication Key는 storage lock으로 중복 처리를 막는다.
3. Retry Bundle은 retry 가능한 실패에만 존재한다.
4. Solution Catalog가 Solution README managed block의 source of truth다.
5. Managed marker 밖 사용자의 README 내용은 보존한다.
6. Content script는 GitHub API를 직접 호출하지 않는다.
7. Sync Repository와 Sync Branch를 코드 기본값으로 고정하지 않는다.
8. Branch를 자동 생성하지 않는다.
9. Swift Solution File은 대상 저장소의 Xcode build source folder 아래에 만들지 않는다.
10. Content bundle은 classic script이며 static ESM `import`가 남지 않는다.

## 알려진 위험과 제약

- Programmers snapshot은 page DOM과 editor 상태를 신뢰한다. Coding Platform origin이 compromise되면 committed source integrity에 영향을 줄 수 있다.
- Connection test는 read-only다. 통과해도 branch protection이나 실제 write 가능성을 보장하지 않는다.
- GitHub token은 OS keychain이 아니라 extension local storage에 저장된다.
- Unpacked extension은 자동 업데이트가 없으며 사용자가 같은 설치 폴더의 파일을 교체하고 Reload해야 한다.
- MV3 service worker는 언제든 suspend될 수 있으므로 cleanup과 진행 상태는 다음 wake-up에서 복구되도록 설계한다.
- Processed Sync Deduplication Key는 correctness를 위해 자동 cap하지 않는다. 장기 저장량은 후속 운영 관찰 대상이다.

## 문서 지도

| 질문 | 문서 |
| --- | --- |
| 현재 프로젝트를 빠르게 이해하려면? | [Project Context](PROJECT_CONTEXT.md) |
| 표준 제품 용어는? | [Context](../CONTEXT.md) |
| 무엇을 만들고 무엇을 제외하는가? | [PRD](PRD.md) |
| runtime, storage와 data flow는? | [Architecture](ARCHITECTURE.md) |
| 왜 이 설계를 선택했는가? | [ADR](adr/) |
| Options, Popup, Toast UI 규칙은? | [UI Guide](UI_GUIDE.md) |
| 실제 Chrome에서 무엇을 검증하는가? | [Manual Validation](MANUAL_VALIDATION.md) |
| 사용자가 어떻게 설치·업데이트하는가? | [README](../README.md) |
| 데이터 처리와 삭제 방법은? | [Privacy](../PRIVACY.md) |
| 취약점은 어떻게 제보하는가? | [Security](../SECURITY.md) |
| 일반적인 오류는 어떻게 복구하는가? | [Troubleshooting](TROUBLESHOOTING.md) |
| Coding agent의 작업 가드레일은? | [Agent Guide](../AGENTS.md) |

## 갱신 규칙

- 제품 범위가 바뀌면 PRD를 먼저 수정하고 이 문서의 제품 경계를 갱신한다.
- runtime, storage, permission, message 또는 배포 구조가 바뀌면 Architecture/ADR을 먼저 수정한다.
- UI action이나 사용자 고지가 바뀌면 UI Guide와 필요 시 Privacy/Manual Validation을 먼저 수정한다.
- release version, toolchain 또는 현재 단계가 바뀌면 `Last verified`와 현재 기준선만 갱신한다.
- 이 문서에 상세 규칙을 복제하지 않는다. 상세 source of truth로 연결하고 현재 의미와 관계만 설명한다.
