# 문서 안내

> **Description**: solve-sync를 처음 보는 사람을 위한 문서 지도다. 정본이 아니며 요약과 링크만 둔다.

## solve-sync란

LeetCode, Programmers, SW Expert Academy(SWEA)에서 문제를 풀어 Accepted(정답 판정)를 받으면, Chrome 확장이 그 풀이를 사용자가 고른 GitHub 저장소에 자동으로 commit한다. 풀이 파일과 함께 진행표(README)도 갱신한다. 별도 backend server는 없고, 브라우저가 GitHub에 직접 보낸다.

```text
문제 제출 → Accepted 판정 → 확장이 화면에서 감지 → 풀이 코드 확보 → GitHub에 commit 하나
```

Accepted 감지는 content script(플랫폼 페이지 안에서 도는 확장 코드)가 맡고, GitHub 쓰기는 background service worker(확장의 백그라운드 프로세스)가 맡는다. 풀이 코드는 플랫폼마다 얻는 곳이 다르다. LeetCode는 background가 조회하고, Programmers와 SWEA는 content script가 화면의 editor에서 읽는다. 자세한 구조는 [ARCHITECTURE](ARCHITECTURE.md)를 본다.

## 이럴 때 이 문서

| 알고 싶은 것 | 문서 |
|---|---|
| 설치하고 쓰는 법 | [루트 README](../README.md) |
| 무엇을 만드는가, 범위와 성공 기준 | [PRD](PRD.md) |
| 내부 구조, 데이터 흐름, storage, 오류 모델 | [ARCHITECTURE](ARCHITECTURE.md) |
| 왜 이렇게 정했는가 | [ADR](adr/README.md) |
| 용어의 뜻 (Sync Repository, Solution Catalog 등) | [CONTEXT](../CONTEXT.md) |
| 플랫폼별 감지 방식, 검증 계층의 정의 | [platforms](platforms/README.md) |
| 플랫폼 동작을 개발 지식 없이 검수 (구현 계약은 platforms, 사용자 관점 동작은 specs가 정본) | [specs](specs/README.md) |
| 화면 구성, 문구, 접근성 | [UI_GUIDE](UI_GUIDE.md) |
| 손으로 확인하는 절차 | [MANUAL_VALIDATION](MANUAL_VALIDATION.md) |
| 자동 검증(e2e) 실행 | [e2e/README](../e2e/README.md) |
| GitHub App 등록과 tester 설치 | [GITHUB_APP_SETUP](GITHUB_APP_SETUP.md) |
| Chrome Web Store 제출 조건과 Release Gate | [CHROME_WEB_STORE](CHROME_WEB_STORE.md) |
| 수집 데이터, 보안 제보 | [PRIVACY](../PRIVACY.md), [SECURITY](../SECURITY.md) |
| 아직 재현되지 않은 증상 | [investigations](investigations/ABOUT.md) |

## 개발을 시작한다면

1. [PRD](PRD.md)로 무엇을 만드는지 잡는다.
2. [CONTEXT](../CONTEXT.md)로 용어를 익힌다. 문서 전체가 이 표기를 쓴다.
3. [ARCHITECTURE](ARCHITECTURE.md)로 구조를 본다.
4. [루트 AGENTS.md](../AGENTS.md)로 작업 규칙(branch, worktree, 명령, 금지 사항)을 확인한다.
5. 고칠 폴더의 `AGENTS.md`(`src/*`, `harness`, `e2e`)를 읽는다.

문서끼리 내용이 다르면 [루트 AGENTS.md](../AGENTS.md)의 Source of Truth 절이 어느 쪽이 맞는지 정한다.
