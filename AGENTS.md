# SolveSync Agent Guide

이 파일은 AI coding agent를 위한 작업 매뉴얼이다. 제품 명세를 복제하지 말고, 작업 전에 어떤 문서를 확인해야 하는지와 구현 중 절대 놓치면 안 되는 가드레일만 제공한다.

SolveSync는 LeetCode와 Programmers에서 Accepted 된 풀이를 사용자가 선택한 GitHub 저장소로 동기화하는 local unpacked Chrome extension이다.

## Source of Truth
- 제품 범위, 사용자 흐름, 성공 기준은 `docs/PRD.md`를 따른다.
- 설계 결정과 tradeoff는 `docs/adr/`의 ADR 파일을 따른다.
- 런타임 구조, 데이터 흐름, storage, messaging, error model은 `docs/ARCHITECTURE.md`를 따른다.
- Options, Popup, Toast UI와 문구/접근성 규칙은 `docs/UI_GUIDE.md`를 따른다.
- 수동 검증 절차는 `docs/MANUAL_VALIDATION.md`를 따른다.
- 이 파일과 `docs/`가 충돌하면 먼저 관련 `docs/`를 확인하고, 실제 정책 변경이 필요하면 해당 문서를 source of truth로 수정한다.

## Project Map
- `src/content`: 문제 페이지 관찰, Accepted 감지, Programmers Accepted Editor Snapshot, toast, background messaging.
- `src/background`: sync orchestration, source resolver, storage, Retry Bundle, Sync History.
- `src/background/client`: LeetCode와 GitHub API client. API 변경 영향은 여기서 막는다.
- `src/options`: PAT, Sync Repository/Sync Branch 선택, branch 생성, Auto Sync, connection test UI.
- `src/popup`: Auto Sync toggle, 최근 Sync History, 실패 상세, retry UI.
- `src/shared`: 타입, Coding Platform policy, message union, language/path mapping, Solution README/Catalog, storage schema, error normalization.

## Do
- 변경 전에 관련 `docs/` 문서를 먼저 읽고, docs와 구현이 어긋나면 사용자에게 명확히 알린다.
- diff는 작고 테스트 가능하게 유지한다.
- 기존 module boundary와 local helper를 우선 사용한다.
- business rule은 가능한 `src/shared` 또는 `src/background` orchestration에 두고 UI 코드는 얇게 유지한다.
- shared pure logic, path, README, index, storage, error normalization을 바꾸면 Vitest 테스트를 함께 추가하거나 갱신한다.
- 외부 API error는 사용자에게 보여주기 전에 normalized error로 변환한다.
- Chrome MV3 service worker의 장기 in-memory state를 source of truth로 쓰지 않는다.
- `content_scripts` bundle은 classic script로 실행된다. content entry build 결과에 static ESM `import`가 남지 않게 한다.

## Don't
- GitHub PAT, LeetCode/Programmers cookie, session token, 실제 사용자 secret을 source, fixture, docs 예시에 넣지 않는다.
- LeetCode/Programmers 문제 설명 전문을 저장하지 않는다.
- content script에서 GitHub API를 직접 호출하지 않는다. 외부 write는 background service worker를 통해 수행한다.
- 대상 GitHub repository나 branch를 코드 기본값으로 고정하지 않는다.
- branch를 자동 생성하지 않는다. 사용자의 명시적 create action이 있을 때만 생성한다.
- README/index/path 규칙을 UI나 API client에 흩뿌리지 않는다. shared pure logic으로 관리한다.
- `dist/`, `node_modules/`, coverage output, build artifact를 커밋하지 않는다.
- 사용자가 명시적으로 요청하지 않는 한 README를 수정하지 않는다.
- 제품/아키텍처 세부 규칙을 AGENTS.md에 장황하게 복제하지 않는다. 해당 `docs/` 문서를 갱신한다.

## High-Risk Rules
- processed Sync Deduplication Key는 GitHub commit 성공 후에만 기록한다.
- 같은 Sync Deduplication Key는 storage 기반 Sync Deduplication Key lock으로 중복 처리를 막는다.
- Retry Bundle에는 solution code가 임시 저장될 수 있으므로 UI disclosure와 TTL/cap 정책을 유지한다.
- Programmers는 공식 제출 상세 API를 전제로 하지 않고 Accepted 직후 Accepted Editor Snapshot을 source로 쓴다.
- Solution README는 Solution Catalog의 projection이다. managed marker 밖 사용자의 수동 내용은 보존한다.
- Swift solution은 대상 저장소의 Xcode build source folder 아래에 만들지 않는다.

## Commands
저장소 루트에서 실행한다.

```bash
npm run typecheck
npm test
npm run build
```

변경 범위가 작으면 관련 Vitest 파일을 먼저 실행해도 된다. 최종 build는 content IIFE bundle 검증까지 포함한다.

## Change Checklist
- 제품 동작이나 scope 변경: `docs/PRD.md` 확인.
- architecture, storage, runtime message, API boundary 변경: `docs/ARCHITECTURE.md`와 `docs/adr/` 확인.
- UI layout, copy, locale, accessibility 변경: `docs/UI_GUIDE.md` 확인.
- sync flow 또는 browser 검증 영향: `docs/MANUAL_VALIDATION.md` 갱신 필요 여부 확인.
- commit message를 작성할 때는 `feat:`, `fix:`, `docs:`, `test:`, `refactor:` 같은 conventional commits 형식을 사용한다.

## When Stuck
- 추측으로 큰 rewrite를 하지 말고, 현재 관찰한 사실과 막힌 지점을 짧게 정리한다.
- 여러 해석이 가능한 제품 결정은 관련 docs 후보를 제시하고 사용자 확인을 받는다.
- repo 상태가 더러우면 사용자가 만든 변경을 되돌리지 말고, 현재 작업과 충돌하는 경우에만 물어본다.
