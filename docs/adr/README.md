# Architecture Decision Records

설계 결정과 tradeoff의 source of truth다. 구현이 ADR과 어긋나면 어느 쪽이 맞는지 먼저 판단하고, 결정이 바뀐 것이면 새 ADR을 쓴다. 기존 ADR을 조용히 고쳐 과거 결정을 덮어쓰지 않는다.

**다음에 쓸 번호는 0037이다.** 아래 "번호 구멍"을 참고한다.

## 목록

| # | 결정 |
|---|---|
| 0001 | [Standalone extension 저장소](0001-standalone-extension-repository.md) |
| 0002 | [Chrome Manifest V3](0002-chrome-manifest-v3.md) |
| 0003 | [TypeScript, Vite, npm, Vitest](0003-typescript-vite-npm-vitest.md) |
| 0004 | [Vanilla DOM UI](0004-vanilla-dom-ui.md) |
| 0005 | [DOM 감지와 Coding Platform별 source 조회 결합](0005-dom-detection-platform-source-lookup.md) |
| 0006 | [v1은 OAuth 대신 fine-grained PAT 사용](0006-fine-grained-pat-for-v1.md) |
| 0007 | [단일 commit을 위해 GitHub Git Data API 사용](0007-github-git-data-api-for-single-commit.md) |
| 0008 | [Solution Catalog를 README source of truth로 사용](0008-solution-catalog-as-readme-source-of-truth.md) |
| 0009 | [Swift solution은 Xcode build folder 밖에 저장](0009-swift-solutions-outside-xcode-build-folder.md) |
| 0010 | [Chrome Web Store 배포는 v2로 연기](0010-defer-chrome-web-store-to-v2.md) |
| 0011 | [외부 API client는 background에 둔다](0011-external-api-clients-in-background.md) |
| 0012 | [LeetCode 조회는 GraphQL 우선으로 격리한다](0012-leetcode-graphql-first-lookup.md) |
| 0013 | [README는 v1에서 항상 갱신한다](0013-always-update-readme-in-v1.md) |
| 0014 | [Sync Repository는 Coding Platform 기준 폴더를 우선한다](0014-coding-platform-first-repository-layout.md) |
| 0015 | [같은 문제/언어는 최신 풀이로 덮어쓴다](0015-overwrite-latest-solution-for-same-problem-language.md) |
| 0016 | [processed marking은 commit 성공 후에만 한다](0016-processed-after-commit-success-only.md) |
| 0017 | [Storage schema는 version을 포함한다](0017-versioned-storage-schema.md) |
| 0018 | [Runtime message는 typed union으로 관리한다](0018-typed-runtime-message-union.md) |
| 0019 | [최소 host permission만 요청한다](0019-minimal-host-permissions.md) |
| 0020 | [Sync Repository와 Sync Branch는 사용자가 선택한다](0020-user-selected-sync-repository-and-branch.md) |
| 0021 | [Branch 생성은 명시적 사용자 action으로만 수행한다](0021-explicit-branch-creation-only.md) |
| 0022 | [Accepted 감지는 mutation 범위의 bounded text traversal을 사용한다](0022-bounded-mutation-text-traversal-for-accepted-detection.md) |
| 0023 | [Content script는 별도 IIFE bundle로 빌드한다](0023-separate-iife-content-script-bundle.md) |
| 0024 | [Coding Platform adapter와 shared sync core를 분리한다](0024-coding-platform-adapters-and-shared-sync-core.md) |
| 0026 | [Domain naming v4 storage/runtime and catalog migration](0026-domain-naming-v4-storage-runtime-and-catalog-migration.md) |
| 0027 | [Solution Revision Number를 commit message에 포함한다](0027-solution-revision-numbered-commit-message.md) |
| 0028 | [Programmers DOM Snapshot Risk Acceptance](0028-programmers-dom-snapshot-risk-acceptance.md) |
| 0029 | [Public GitHub App Device Flow와 local token refresh 사용](0029-public-github-app-device-flow-with-local-token-refresh.md) |
| 0030 | [중앙 language registry와 단일 README Languages column 사용](0030-central-language-registry-and-single-readme-languages-column.md) |
| 0034 | [Fresh Accepted transition은 route-bound immutable event로 캡처한다](0034-fresh-accepted-transition-and-immutable-event.md) |
| 0035 | [SWEA editor code는 MAIN world bridge로 읽는다](0035-main-world-editor-bridge-for-swea.md) |
| 0036 | [Content route key는 adapter가 확정한다](0036-adapter-resolved-content-route-key.md) |

## 번호 구멍

번호를 재사용하지 않는다. 재사용하면 과거 commit, PR, 코드 주석의 ADR 참조가 다른 문서를 가리키게 된다.

**0025 — 하네스 전용 결정이었고 하네스 자동화와 함께 제거됐다.**
harness validation과 dirty recovery 정책을 다뤘다. 자동화 orchestration을 걷어내면서(#26) 대상이 사라졌다.

**0031, 0032, 0033 — 제안됐으나 구현되지 않았고 branch째 폐기됐다.**
`agent/preview-distribution-hardening` branch에만 존재했고 그 branch는 origin에서 삭제됐다.

| # | 제목 | 현재 상태 |
|---|---|---|
| 0031 | trusted storage and sender-scoped runtime ingress | 미구현. `src/background/runtime.ts`에 sender 신뢰 검사가 없다 |
| 0032 | alarm-backed retry retention and explicit local deletion | 미구현. `chrome.alarms` 사용처가 없다 |
| 0033 | reproducible GitHub preview release pipeline | 미구현 |

세 결정 모두 **여전히 유효한 문제 제기다.** 다시 다루기로 하면 새 번호로 쓴다. 특히 0031의 sender 검증은 content script 외의 발신자가 background로 message를 보낼 수 있는지와 직결되므로, 출시 전에 재검토할 가치가 있다.
