# SolveSync Agent Guide

이 파일은 AI coding agent를 위한 작업 매뉴얼이다. 제품 명세를 복제하지 말고, 작업 전에 어떤 문서를 확인해야 하는지와 구현 중 절대 놓치면 안 되는 가드레일만 제공한다.

`CLAUDE.md`는 이 파일을 가리키는 symlink다. codex는 `AGENTS.md`를, Claude Code는 `CLAUDE.md`를 읽지만 실체는 하나다. 어느 이름으로 열어 편집해도 같은 파일이 바뀐다. 규칙을 두 파일로 나누면 반드시 어긋나므로 복사본을 만들지 않는다.

SolveSync는 LeetCode, Programmers와 SWEA에서 Accepted 된 풀이를 사용자가 선택한 GitHub 저장소로 동기화하는 Chrome extension이다. 배포는 Chrome Web Store와 GitHub Release ZIP 두 경로다([ADR 0038](docs/adr/0038-chrome-web-store-public-release.md)).

## Source of Truth
- 제품 범위, 사용자 흐름, 성공 기준은 `docs/PRD.md`를 따른다.
- 설계 결정과 tradeoff는 `docs/adr/`의 ADR 파일을 따른다. 목록과 다음에 쓸 번호는 `docs/adr/README.md`에 있다. ADR 번호는 재사용하지 않는다.
- 런타임 구조, 데이터 흐름, storage, messaging, error model은 `docs/ARCHITECTURE.md`를 따른다.
- Options, Popup, Toast UI와 문구/접근성 규칙은 `docs/UI_GUIDE.md`를 따른다.
- 수동 검증 절차는 `docs/MANUAL_VALIDATION.md`를 따른다.
- Coding Platform별 route 출처, Accepted 감지 방식, solution code source, `acceptedSourceId` 형식, 오류 코드는 `docs/platforms/`를 따른다. 공통 계약과 플랫폼 사이의 차이는 `docs/platforms/README.md`에 있고, 플랫폼 문서는 공통과 다른 것만 적는다.
- 도메인 용어의 정의와 표기는 `CONTEXT.md`를 따른다.
- `docs/investigations/`는 source of truth가 아니다. 아직 재현되지 않은 증상, 원인 가설과 재현 시 수집할 근거만 기록한다.
- 이 파일과 `docs/`가 충돌하면 먼저 관련 `docs/`를 확인하고, 실제 정책 변경이 필요하면 해당 문서를 source of truth로 수정한다.

## Language
- 산문은 한국어로 쓴다. `docs/`, 코드 주석과 docstring, commit message subject, PR 제목과 본문, GitHub Issue 코멘트가 여기에 해당한다.
- `harness/`의 prompt, JSON schema description, `.claude/`의 agent와 skill 문서, 그리고 사람이나 agent가 읽는 런타임 메시지(hook 차단 사유, 검증 실패 메시지)도 한국어로 쓴다.
- 식별자는 번역하지 않는다. 파일 경로, 함수/변수 이름, branch 이름, conventional commit type(`feat:`, `fix:` 등), `CONTEXT.md`가 정의한 도메인 용어는 원문 그대로 쓴다.
- 도메인 용어는 `CONTEXT.md`의 표기를 따르고, 같은 개념을 한국어로 임의 번역해 새 용어를 만들지 않는다.
- 사용자에게 보이는 UI 문구는 `docs/UI_GUIDE.md`의 locale 규칙을 따른다. 이 section은 저장소 안에서 개발자끼리 주고받는 글에 대한 규칙이다.

## Git Workflow
- **조사와 계획의 결과물은 문서 파일이 아니라 PR body에 남기는 것이 기본값이다.** 착수 근거, 무엇을 왜 바꿨는지, 어떻게 검증했는지가 여기에 들어간다.
- **GitHub Issue는 선택이다.** 지금 고치지 않을 것을 기록할 때 만든다. 재현되지 않은 버그, 나중에 할 일, 사용자와 합의가 더 필요한 결정이 그렇다. 지금 바로 고칠 것이라면 이슈 없이 branch를 만들고 PR로 간다. 이슈를 만들었다면 PR body에 `Fixes #<number>`로 잇는다.
- 계획을 승인받았다고 해서 파일 변경까지 승인된 것은 아니다. 짧은 승인은 다음 한 단계에만 적용한다. 계획을 제시한 뒤 착수 여부를 다시 확인한다.
- 구현이나 문서 변경을 시작하기 전에 `git status --short --branch`와 현재 branch를 확인한다.
- `main`에서는 직접 작업하거나 commit하지 않는다. 현재 `main`을 base로 work branch를 만든 뒤 변경한다.
- **work branch 작업은 `{root}-wt/{slug}` worktree에서 한다.** 주 작업 디렉터리의 branch를 갈아타지 않는다. 다른 세션이나 다른 agent가 그 디렉터리에서 작업 중일 수 있고, branch를 갈아타면 그쪽 작업이 조용히 깨진다. 주 디렉터리는 worktree를 만들고 지우는 용도로 쓴다.

  ```bash
  git worktree add -b feat/worktree-isolation-gate ../SolveSync-wt/worktree-isolation-gate main
  ```

  이 규칙은 두 층이 강제한다. pre-commit gate가 주 디렉터리에서의 커밋을 막고, `.claude/settings.json`이 배선한 PreToolUse hook이 주 디렉터리에서의 branch 전환을 막는다. 커밋 gate만으로는 이미 남의 branch를 밀어낸 뒤에 막힌다.
- work branch 이름은 `{type}/{slug}` 형식이다. `type`은 `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci` 중 하나이고 `slug`는 kebab-case다. 예: `chore/shrink-harness`. 이슈가 있으면 `chore/issue-56-shrink-harness`처럼 slug에 번호를 넣어도 된다.
- 이 형식은 pre-commit gate가 강제한다. 목록에 없는 접두사를 쓰거나 type이 없으면 커밋이 막힌다. 우회용 접두사는 두지 않는다.
- `main`과 `origin/main`이 어긋나 있으면 그대로 진행하지 말고 base 상태를 먼저 정리한다. 사용자 변경이 섞여 있으면 되돌리지 말고 현재 작업과의 관계를 확인한다.
- 이미 `main`에 현재 작업의 미커밋 변경이 있다면 버리지 않는다. 작업 범위가 명확하면 새 work branch로 함께 가져가고, 다른 작업과 섞여 있으면 사용자에게 확인한다.
- 변경 전달은 work branch에서 검증한 뒤 Pull Request를 통해 수행한다. `main`으로 직접 push하거나 직접 merge하는 흐름을 사용하지 않는다.
- PR body에는 무엇을 왜 바꿨는지와 어떻게 검증했는지를 남긴다. 근거가 된 이슈가 있으면 `Fixes #<number>` 또는 적절한 issue link로 함께 포함한다.
- commit, push, PR 생성처럼 저장소나 GitHub 상태를 바꾸는 게시 단계는 사용자가 해당 작업에서 요청하거나 승인한 범위에서 수행한다.
- 이 section의 development work branch와 제품이 사용자의 Sync Repository에 만드는 Sync Branch는 서로 다른 개념이다. 제품의 Sync Branch 자동 생성 금지 규칙은 그대로 유지한다.

## Guardrails
`harness/`는 이 저장소를 망가뜨리는 변경을 막는 gate다. 자동으로 일해주는 도구가 아니다. 구현은 Claude Code 대화형 세션에서 하고, `harness/`는 그 작업이 규칙을 벗어나지 못하게만 한다.

구조는 여섯 파일이 전부다. `policy.py`가 규칙을 갖고 나머지는 각 시점에 그것을 붙이는 얇은 adapter다.

| 파일 | 역할 |
|---|---|
| `harness/policy.py` | 차단 규칙. 순수 함수이고 부수효과가 없다 |
| `harness/hooks/pre-commit` | commit 시점 gate |
| `harness/hooks/claude_pretooluse.py` | Claude Code 도구 호출 시점 gate |
| `harness/ci_gate.py` | CI 시점 gate. hook이 설치되지 않은 checkout을 위한 그물 |
| `harness/tests/test_policy.py` | 규칙 테스트 |
| `harness/tests/test_ci_gate.py` | CI gate 회귀 테스트. 임시 저장소로 git 출력 해석을 고정한다 |

설치는 한 줄이다. 저장소를 새로 clone하면 실행한다.

```bash
git config core.hooksPath harness/hooks
```

- 이 설정이 있으면 commit마다 `npm run typecheck`, `npm test`, `npm run build` 전체와 secret scan, 금지 경로, `main` branch 차단, work branch 이름 검사, 주 worktree 차단이 실행된다. `harness/`를 건드리는 commit에서는 `harness/tests`도 함께 돈다.
- `.claude/settings.json`이 `harness/hooks/claude_pretooluse.py`를 PreToolUse에 배선한다. 대화형 세션에는 금지 경로, gate 우회 차단, 주 디렉터리 branch 전환 차단이 도구 호출 전에 적용된다. 게시(`git push`, `gh pr`, `gh issue`)와 저장소 밖 경로는 막지 않는다 — 대화형 세션에서는 그것이 정상 작업이다.
- `.github/workflows/ci.yml`이 `harness/ci_gate.py`를 PR과 `main` push에서 실행한다. `core.hooksPath`는 clone마다 사람이 켜는 opt-in이고 git은 설정이 없으면 경고 없이 hook을 건너뛰므로, pre-commit이 한 번도 돌지 않은 커밋이 올라올 수 있다. CI가 다시 보는 것은 되돌릴 수 없는 둘, secret과 산출물 경로뿐이다. branch 이름처럼 되돌릴 수 있는 것은 다시 보지 않는다.
- **pre-commit이 최후 방어선이다.** 누가 커밋하든, 어떤 도구를 거쳤든 걸린다. PreToolUse는 그보다 앞서는 조기 경보이므로, 둘 중 하나만 남는다면 pre-commit이 남아야 한다.
- **gate는 되돌릴 수 없는 것만 막는다.** secret 유출, 남의 worktree 파괴, 산출물 커밋처럼 조용히 일어나고 되돌리기 비싼 것이 대상이다. "제대로 된 순서로 일해라" 같은 프로세스 훈육은 gate가 아니라 이 문서의 산문 규칙으로 둔다. 파일 존재만 검사하는 gate는 빈 파일 하나로 통과하므로 보호 장치처럼 보이면서 아무것도 막지 않는다.
- gate를 `--no-verify`로 우회하지 않는다. 막히면 막은 이유를 고친다.
- **gate는 base branch에 있어야 동작한다.** worktree는 base branch에서 분기하므로, gate가 없는 base에서 만든 worktree에는 commit gate가 없다. git은 `core.hooksPath`가 없는 디렉터리를 가리켜도 경고하지 않고 조용히 hook을 건너뛴다.
- 규칙을 고칠 때는 `harness/tests/`를 함께 고친다. `policy.py`는 신뢰 경계이고, 죽은 분기를 남기면 보호 장치처럼 보이는데 아무것도 하지 않는 코드가 된다.

## Project Map
- `src/content`: 문제 페이지 관찰, Accepted 감지, Accepted Editor Snapshot, SWEA MAIN world editor bridge, toast, background messaging.
- `src/background`: sync orchestration, source resolver, storage, Retry Bundle, Sync History.
- `src/background/client`: LeetCode와 GitHub API client. API 변경 영향은 여기서 막는다.
- `src/options`: GitHub Device Flow/App 설치, Sync Repository/Sync Branch 선택, branch 생성, Auto Sync, connection test UI.
- `src/popup`: Auto Sync toggle, 최근 Sync History, 실패 상세, retry UI.
- `src/shared`: 타입, Coding Platform policy, message union, language/path mapping, Solution README/Catalog, storage schema, error normalization.
- `docs/platforms`: Coding Platform 연동 계약. adapter나 감지 로직을 바꾸기 전에 읽는다.

## Do
- 변경 전에 관련 `docs/` 문서를 먼저 읽고, docs와 구현이 어긋나면 사용자에게 명확히 알린다.
- diff는 작고 테스트 가능하게 유지한다.
- 기존 module boundary와 local helper를 우선 사용한다.
- business rule은 가능한 `src/shared` 또는 `src/background` orchestration에 두고 UI 코드는 얇게 유지한다.
- shared pure logic, path, README, index, storage, error normalization을 바꾸면 Vitest 테스트를 함께 추가하거나 갱신한다.
- `src/shared`와 `src/background`의 로직 파일은 같은 디렉터리에 `<모듈>.test.ts`를 둔다. 버그 수정은 재현 테스트를 먼저 작성하고 통과시키는 순서로 진행한다.
- 외부 API error는 사용자에게 보여주기 전에 normalized error로 변환한다.
- Chrome MV3 service worker의 장기 in-memory state를 source of truth로 쓰지 않는다.
- `content_scripts` bundle은 classic script로 실행된다. content entry와 SWEA MAIN world bridge build 결과에 static ESM `import`가 남지 않게 한다.
- 미재현 edge case를 남길 때는 `docs/investigations/`에 상태, 증상, 가설, 구분 조건, 안전한 증거 수집 범위와 승격 조건을 함께 기록한다. 실제 재현되면 회귀 테스트와 구현을 갱신하고, 계약 변경이 있으면 관련 source of truth도 수정한 뒤 investigation note를 정리한다.

## Don't
- GitHub access/refresh token, Device Flow device code, legacy PAT, LeetCode/Programmers cookie, session token, 실제 사용자 secret을 source, fixture, docs 예시에 넣지 않는다.
- LeetCode/Programmers 문제 설명 전문을 저장하지 않는다.
- content script에서 GitHub API를 직접 호출하지 않는다. 외부 write는 background service worker를 통해 수행한다.
- 대상 GitHub repository나 branch를 코드 기본값으로 고정하지 않는다.
- branch를 자동 생성하지 않는다. 사용자의 명시적 create action이 있을 때만 생성한다.
- README/index/path 규칙을 UI나 API client에 흩뿌리지 않는다. shared pure logic으로 관리한다.
- `dist/`, `node_modules/`, coverage output, build artifact를 커밋하지 않는다.
- 사용자가 명시적으로 요청하지 않는 한 README를 수정하지 않는다.
- 제품/아키텍처 세부 규칙을 AGENTS.md에 장황하게 복제하지 않는다. 해당 `docs/` 문서를 갱신한다.
- Investigation의 가설을 확정된 Known Issue, troubleshooting 절차나 제품 계약처럼 표현하지 않는다.

## High-Risk Rules
- processed Sync Deduplication Key는 GitHub commit 성공 후에만 기록한다.
- 같은 Sync Deduplication Key는 storage 기반 Sync Deduplication Key lock으로 중복 처리를 막는다.
- Retry Bundle에는 solution code가 임시 저장될 수 있으므로 UI disclosure와 TTL/cap 정책을 유지한다.
- Programmers와 SWEA는 공식 제출 상세 API를 전제로 하지 않고 Accepted 직후 Accepted Editor Snapshot을 source로 쓴다. SWEA editor code는 MAIN world bridge에서만 읽을 수 있고 bridge protocol에는 code string만 넣는다.
- Solution README는 Solution Catalog의 projection이다. managed marker 밖 사용자의 수동 내용은 보존한다.
- Swift solution은 대상 저장소의 Xcode build source folder 아래에 만들지 않는다.

## Commands
저장소 루트에서 실행한다.

```bash
npm run typecheck
npm test
npm run build
```

`harness/`를 바꿨으면 함께 돌린다. CI가 실행하는 것과 같은 명령이다.

```bash
python3 -m unittest discover -s harness/tests -t harness
```

Chrome Web Store 제출용 ZIP은 `npm run package:chrome`이 만든다. `dist` 내용만 담고 필수/금지 경로를 검증한다.

변경 범위가 작으면 관련 Vitest 파일을 먼저 실행해도 된다. 최종 build는 content IIFE bundle 검증까지 포함한다.

Node는 `package.json`의 `engines`가 하한을 정한다. `.github/workflows/ci.yml`은 그 하한 버전을 고정해서 돌리므로 로컬이 더 새 버전이어도 CI가 하한을 검증한다. 하한을 올릴 때는 두 곳을 함께 바꾼다.

## Change Checklist
- 제품 동작이나 scope 변경: `docs/PRD.md` 확인.
- architecture, storage, runtime message, API boundary 변경: `docs/ARCHITECTURE.md`와 `docs/adr/` 확인.
- UI layout, copy, locale, accessibility 변경: `docs/UI_GUIDE.md` 확인.
- sync flow 또는 browser 검증 영향: `docs/MANUAL_VALIDATION.md` 갱신 필요 여부 확인.
- Coding Platform 감지, adapter, 오류 코드 변경: `docs/platforms/`의 해당 플랫폼 문서와 README 표 확인.
- commit message를 작성할 때는 `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, `ci:` 같은 conventional commits 형식을 사용한다. branch type과 같은 목록이다.

## When Stuck
- 추측으로 큰 rewrite를 하지 말고, 현재 관찰한 사실과 막힌 지점을 짧게 정리한다.
- 여러 해석이 가능한 제품 결정은 관련 docs 후보를 제시하고 사용자 확인을 받는다.
- repo 상태가 더러우면 사용자가 만든 변경을 되돌리지 말고, 현재 작업과 충돌하는 경우에만 물어본다.
