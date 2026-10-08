# solve-sync Agent Guide

이 파일은 AI coding agent를 위한 입구다. 저장소가 어떻게 나뉘어 있고 무엇을 먼저 읽어야 하는지, 그리고 구현 중 절대 놓치면 안 되는 규칙만 담는다. 제품 명세와 작업 절차는 여기 복제하지 않고 해당 문서를 가리킨다.

규칙 문서는 이 파일 하나와 여기서 가리키는 문서들이다. `CLAUDE.md` 같은 도구별 이름의 사본이나 symlink를 두지 않는다. 규칙을 두 파일로 나누면 반드시 어긋난다. Claude Code는 `AGENTS.md`를 자동으로 읽지 않으므로 작업을 시작할 때 이 파일을 직접 읽는다.

solve-sync는 LeetCode, Programmers와 SWEA에서 Accepted 된 풀이를 사용자가 선택한 GitHub 저장소로 동기화하는 Chrome extension이다. 배포는 Chrome Web Store와 GitHub Release ZIP(Chrome에서 Load unpacked로 설치) 두 경로다([ADR 0046](docs/adr/0046-chrome-web-store-alongside-release-zip.md)).

## 저장소 구조

저장소는 세 묶음으로 나뉜다. 질문이 "어떻게 일하나"면 `workflow/`, "무엇을 만드나"면 `docs/`, "코드가 어디 있나"면 나머지다.

| 묶음 | 경로 | 담는 것 |
|---|---|---|
| 작업 절차 | [`workflow/`](workflow/README.md) | branch·worktree·PR 절차, 언어 규칙, 문서 추가 플로우, 검증 명령, 그리고 그중 되돌리기 비싼 규칙을 강제하는 gate 코드(`workflow/gates/`) |
| 제품 정본 | [`docs/`](docs/README.md), [`CONTEXT.md`](CONTEXT.md) | PRD, ARCHITECTURE, ADR, 플랫폼 계약, 동작 명세, UI 규칙, 검증 절차, 배포·보안 문서, 코드 폴더별 module 문서(`docs/modules/`), 도메인 용어 |
| 코드 | `src/`, `e2e/`, `scripts/`, `manifest.json`, `vite.*.ts` | 확장 소스, Playwright 검증, npm script가 부르는 빌드·검증 도구 |

도구가 위치를 정하는 것은 그 자리에 둔다. `.claude/`는 Claude Code hook 배선과 skill, `.github/`는 CI와 PR·Issue 템플릿이다. 개인 작업 계획과 메모는 `.local/`에 두며 추적하지 않는다. 코드 폴더 안에는 markdown을 두지 않는다. 배포 ZIP은 `dist/`만 담으므로 문서는 어디에 있어도 사용자에게 가지 않는다.

## 무엇을 먼저 읽나

1. 작업을 시작할 때: 이 파일, [`workflow/git-workflow.md`](workflow/git-workflow.md).
2. 코드 폴더를 고치기 전에: [`docs/modules/`](docs/modules/README.md)에서 그 폴더의 문서. `src/background`면 `docs/modules/background.md`다.
3. 제품 동작을 바꾸기 전에: 아래 Source of Truth에서 해당 정본. 변경 종류별 확인 목록은 [`workflow/commands.md`](workflow/commands.md)에 있다.
4. 문서나 ADR, 용어를 추가할 때: [`workflow/authoring.md`](workflow/authoring.md).
5. gate에 막혔을 때: 차단 사유를 읽고 고친다. 규칙이 궁금하면 [`workflow/gates.md`](workflow/gates.md).

## Source of Truth
- 제품 범위, 사용자 흐름, 성공 기준은 `docs/PRD.md`를 따른다.
- 설계 결정과 tradeoff는 `docs/adr/`의 ADR 파일을 따른다. 목록과 다음에 쓸 번호는 `docs/adr/README.md`에 있다. ADR 번호는 재사용하지 않는다.
- 런타임 구조, 데이터 흐름, storage, messaging, error model은 `docs/ARCHITECTURE.md`를 따른다.
- 코드 폴더별 소유 책임과 변경 절차는 `docs/modules/`를 따른다. 제품 규칙의 정본은 아니며 위 문서들을 링크한다.
- Options, Popup, Toast UI와 문구/접근성 규칙은 `docs/UI_GUIDE.md`를 따른다.
- 수동 검증 절차는 `docs/MANUAL_VALIDATION.md`, 자동 검증은 `e2e/README.md`를 따른다.
- Coding Platform별 route 출처, Accepted 감지 방식, solution code source, `acceptedSourceId` 형식, 오류 코드는 `docs/platforms/`를 따른다. 공통 계약과 플랫폼 사이의 차이는 `docs/platforms/README.md`에 있고, 플랫폼 문서는 공통과 다른 것만 적는다.
- 사용자 관점의 관측 가능한 동작 명세는 `docs/specs/`, 구현 계약은 `docs/platforms/`를 따른다. 둘이 어긋나면 구현이 무엇을 하는지는 `docs/platforms/`가 맞고, 그것이 옳은 동작인지는 `docs/specs/`의 열린 질문으로 올린다([규칙](docs/specs/README.md)).
- 도메인 용어의 정의와 표기는 `CONTEXT.md`를 따른다.
- Store 제출 조건과 Release Gate는 `docs/CHROME_WEB_STORE.md`, Listing·Privacy 답변은 `docs/STORE_SUBMISSION.md`, GitHub App 등록은 `docs/GITHUB_APP_SETUP.md`, 수집 데이터와 보안 제보는 `PRIVACY.md`와 `SECURITY.md`를 따른다.
- `docs/README.md`는 문서 지도다. 정본이 아니며 어느 문서를 읽을지만 알려준다.
- `docs/investigations/`는 source of truth가 아니다. 아직 재현되지 않은 증상, 원인 가설과 재현 시 수집할 근거만 기록한다. 가설을 확정된 Known Issue나 제품 계약처럼 쓰지 않는다.
- `.local/`의 계획은 source of truth가 아니다. 계획과 `docs/`가 다르면 `docs/`가 맞다. 계획이 정책 변경을 요구하면 해당 정본을 먼저 고친 뒤 계획을 따른다.
- 이 파일과 `docs/`가 충돌하면 먼저 관련 `docs/`를 확인하고, 실제 정책 변경이 필요하면 해당 문서를 source of truth로 수정한다.

## 작업 방식
세부는 [`workflow/`](workflow/README.md)에 있다. 여기는 매 작업에서 걸리는 것만 둔다.

- `main`에서 직접 작업하지 않는다. `{type}/{slug}` branch를 `{root}-wt/{slug}` worktree에 만들어 작업하고 PR로 전달한다. 주 디렉터리의 branch를 갈아타지 않는다.
- 계획 승인은 파일 변경 승인이 아니다. commit, push, PR 생성은 사용자가 요청하거나 승인한 범위에서만 한다.
- 변경 전에 관련 `docs/`를 먼저 읽고, docs와 구현이 어긋나면 사용자에게 알린다. 플랫폼 page를 조사하기 전에 `docs/platforms/`를 grep한다. 이미 실측된 사실이 있을 수 있다.
- 산문은 한국어, 식별자와 도메인 용어는 원문이다([language](workflow/language.md)).
- 치환 기반 편집(`sed`, python `str.replace`)은 반영됐는지 확인한다. 조용히 no-op되면 그 뒤 디버깅이 전부 엉뚱한 곳을 판다.
- diff는 작고 테스트 가능하게 유지한다. `src/shared`와 `src/background`의 로직 파일은 같은 디렉터리에 `<모듈>.test.ts`를 두고, 버그 수정은 재현 테스트를 먼저 쓴다.
- gate가 막으면 `--no-verify`로 우회하지 않고 차단 사유를 고친다.
- 사용자가 명시적으로 요청하지 않는 한 루트 `README.md`를 수정하지 않는다.
- 제품/아키텍처 세부 규칙을 이 파일이나 `workflow/`에 복제하지 않는다. 해당 `docs/` 문서를 갱신하고 링크한다.

## 제품 불변식
코드를 바꿀 때 어느 module에서든 지켜야 하는 것이다. 각 항목의 정본은 괄호의 문서다.

- GitHub access/refresh token, Device Flow device code, legacy PAT, LeetCode/Programmers cookie, session token, 실제 사용자 secret을 source, fixture, docs 예시에 넣지 않는다. gate가 일부 패턴을 막지만 전부는 아니다.
- LeetCode/Programmers 문제 설명 전문을 저장하지 않는다(`PRIVACY.md`, `docs/PRD.md`).
- content script에서 GitHub API를 직접 호출하지 않는다. 외부 write는 background service worker를 통한다([ADR 0011](docs/adr/0011-external-api-clients-in-background.md)).
- 대상 GitHub repository나 branch를 코드 기본값으로 고정하지 않고, branch를 자동 생성하지 않는다. 사용자의 명시적 create action이 있을 때만 생성한다([ADR 0020](docs/adr/0020-user-selected-sync-repository-and-branch.md)).
- processed Sync Deduplication Key는 GitHub commit 성공 후에만 기록한다. 예외는 Sync Branch의 Solution Catalog가 그 Accepted를 이미 담고 있어 commit을 건너뛴 경우뿐이다([ADR 0016](docs/adr/0016-processed-after-commit-success-only.md), [ADR 0042](docs/adr/0042-skip-commit-for-accepted-already-in-solution-catalog.md)).
- 같은 Sync Deduplication Key는 storage 기반 lock으로 중복 처리를 막는다. Chrome MV3 service worker의 장기 in-memory state를 source of truth로 쓰지 않는다(`docs/ARCHITECTURE.md`).
- Retry Bundle에는 solution code가 임시 저장될 수 있으므로 UI disclosure와 TTL/cap 정책을 유지한다(`docs/ARCHITECTURE.md`, `docs/UI_GUIDE.md`).
- Programmers와 SWEA는 공식 제출 상세 API를 전제로 하지 않고 Accepted 직후 Accepted Editor Snapshot을 source로 쓴다. SWEA editor code는 MAIN world bridge에서만 읽을 수 있고 bridge protocol에는 code string만 넣는다(`docs/platforms/`).
- README/index/path 규칙은 `src/shared` pure logic이 소유한다. UI나 API client에 흩뿌리지 않는다. Solution README는 Solution Catalog의 projection이며 managed marker 밖 사용자의 수동 내용은 보존한다([ADR 0008](docs/adr/0008-solution-catalog-as-readme-source-of-truth.md)).
- Swift solution은 대상 저장소의 Xcode build source folder 아래에 만들지 않는다([ADR 0009](docs/adr/0009-swift-solutions-outside-xcode-build-folder.md)).
- 외부 API error는 사용자에게 보여주기 전에 normalized error로 변환한다(`docs/ARCHITECTURE.md`).
- `content_scripts` bundle은 classic script다. content entry와 SWEA MAIN world bridge build 결과에 static ESM `import`가 남지 않게 한다. `npm run build`가 검사한다.
- `dist/`, `node_modules/`, coverage output, build artifact를 커밋하지 않는다. gate가 막는다.

## Commands
저장소 루트에서 실행한다. 범위별 추가 검증과 변경 종류별 확인 목록은 [`workflow/commands.md`](workflow/commands.md)에 있다.

```bash
npm run typecheck
npm test
npm run build
```

## When Stuck
- 추측으로 큰 rewrite를 하지 말고, 현재 관찰한 사실과 막힌 지점을 짧게 정리한다.
- 여러 해석이 가능한 제품 결정은 관련 docs 후보를 제시하고 사용자 확인을 받는다.
- repo 상태가 더러우면 사용자가 만든 변경을 되돌리지 말고, 현재 작업과 충돌하는 경우에만 물어본다.

<!-- harness-backlog:start -->
## 하네스 개선 backlog
- 하네스(AGENTS.md, 스킬, 규칙, 스크립트, 설정)의 빈틈은 `.local/harness-backlog/`에 제안으로 쌓인다. 세션이 끝나면 다른 모델이 검토해 남긴다.
- 실수나 교정을 계기로 하네스 파일을 스스로 고치지 않는다. 반영은 사용자가 항목을 보고 "반영해"라고 한 뒤에만 한다. 사용자가 직접 요청한 하네스 작업은 그 범위에서 한다.
- "backlog 보자", "세션 검토해줘"는 `harness-backlog` 스킬로 처리한다.
<!-- harness-backlog:end -->
