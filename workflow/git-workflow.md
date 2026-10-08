# Git Workflow

branch, worktree, commit, PR, merge 뒤 정리까지 저장소 상태를 바꾸는 절차다. 여기의 규칙 중 되돌리기 비싼 것은 [gate](gates.md)가 코드로 강제한다.

## 기록은 어디에 남기나
- **조사와 계획의 결과물은 문서 파일이 아니라 PR body에 남기는 것이 기본값이다.** 착수 근거, 무엇을 왜 바꿨는지, 어떻게 검증했는지가 여기에 들어간다.
- **GitHub Issue는 선택이다.** 지금 고치지 않을 것을 기록할 때 만든다. 나중에 할 일, 사용자와 합의가 더 필요한 결정이 그렇다. 지금 바로 고칠 것이라면 이슈 없이 branch를 만들고 PR로 간다. 이슈를 만들었다면 PR body에 `Fixes #<number>`로 잇는다.
- 재현되지 않은 버그는 Issue와 `docs/investigations/` 중 어디에 쓰는지 [authoring](authoring.md)이 정한다.
- 개인 작업 계획과 메모는 `.local/`에 둔다. gitignore 대상이며 저장소에 올라가지 않는다.

## 시작하기 전에
- 계획을 승인받았다고 해서 파일 변경까지 승인된 것은 아니다. 짧은 승인은 다음 한 단계에만 적용한다. 계획을 제시한 뒤 착수 여부를 다시 확인한다.
- 구현이나 문서 변경을 시작하기 전에 `git status --short --branch`와 현재 branch를 확인한다.
- `main`과 `origin/main`이 어긋나 있으면 그대로 진행하지 말고 base 상태를 먼저 정리한다. 사용자 변경이 섞여 있으면 되돌리지 말고 현재 작업과의 관계를 확인한다.
- 이미 `main`에 현재 작업의 미커밋 변경이 있다면 버리지 않는다. 작업 범위가 명확하면 새 work branch로 함께 가져가고, 다른 작업과 섞여 있으면 사용자에게 확인한다.

## work branch와 worktree
- `main`에서는 직접 작업하거나 commit하지 않는다. 현재 `main`을 base로 work branch를 만든 뒤 변경한다.
- work branch 이름은 `{type}/{slug}` 형식이다. `type`은 `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci` 중 하나이고 `slug`는 kebab-case다. 예: `chore/shrink-harness`. 이슈가 있으면 `chore/issue-56-shrink-harness`처럼 slug에 번호를 넣어도 된다. pre-commit gate는 이 중 type 접두사만 강제한다. 목록에 없는 접두사를 쓰거나 type이 없으면 커밋이 막힌다. slug의 kebab-case는 관례이고 gate가 검사하지 않는다. 좁히면 정상 branch를 막을 위험만 늘기 때문이다. 우회용 접두사는 두지 않는다.
- **work branch 작업은 `{root}-wt/{slug}` worktree에서 한다.** 주 작업 디렉터리의 branch를 갈아타지 않는다. 다른 세션이나 다른 agent가 그 디렉터리에서 작업 중일 수 있고, branch를 갈아타면 그쪽 작업이 조용히 깨진다. 주 디렉터리는 worktree를 만들고 지우는 용도로 쓴다.

  ```bash
  git worktree add -b feat/worktree-isolation-gate ../solve-sync-wt/worktree-isolation-gate main
  ```

- 새 worktree에는 `node_modules`가 없다. pre-push가 typecheck, test, build를 돌리므로 그대로 push하면 `tsc: command not found`로 막힌다. 주 디렉터리의 `node_modules`를 symlink로 걸거나 worktree에서 `npm ci`를 돌린다. symlink 쪽이 의존성을 다시 내려받지 않아 빠르고, gate 전체가 그 상태로 통과한다.

  ```bash
  ln -s {repo-root}/node_modules node_modules
  ```

- `e2e/`를 돌릴 worktree에는 `.env`도 복사한다. `playwright.config.ts`가 `import.meta.dirname` 기준으로 읽어 주 디렉터리에 두면 조용히 무시된다. symlink가 아니라 복사인 이유는 worktree를 지울 때 자격증명 사본도 함께 사라지게 하기 위해서다.
- 단 `package-lock.json`을 바꾸는 branch에서는 symlink를 쓰지 않는다. 주 디렉터리의 의존성을 조용히 쓰게 되어 lock 변경을 검증하지 못한다. 그때는 `npm ci`를 돌린다.
- worktree에 symlink로 거는 것은 `.gitignore` 패턴에 슬래시를 붙이지 않는다. 슬래시는 디렉터리만 잡는데 symlink는 디렉터리가 아니라 그대로 untracked로 뜬다. `node_modules`와 `.verification-profile`이 여기 해당하고, 후자는 로그인 세션이 들어 있어 실제로 위험했다.
- 이 규칙은 두 층이 강제한다. pre-commit gate가 주 디렉터리에서의 커밋을 막고, `.claude/settings.json`이 배선한 PreToolUse hook이 주 디렉터리에서의 branch 전환을 막는다. 커밋 gate만으로는 이미 남의 branch를 밀어낸 뒤에 막힌다.
- 이 문서의 development work branch와 제품이 사용자의 Sync Repository에 만드는 Sync Branch는 서로 다른 개념이다. 제품의 Sync Branch 자동 생성 금지 규칙은 그대로 유지한다.

## commit과 PR
- commit message는 `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, `ci:` 같은 conventional commits 형식을 쓴다. branch type과 같은 목록이다.
- 변경 전달은 work branch에서 검증한 뒤 Pull Request를 통해 수행한다. `main`으로 직접 push하거나 직접 merge하는 흐름을 사용하지 않는다. 이것은 gate가 강제하지 않는 절차 규칙이다. pre-push는 대상 branch가 `main`인지 보지 않는다.
- PR 제목과 본문은 [`.github/PULL_REQUEST_TEMPLATE.md`](../.github/PULL_REQUEST_TEMPLATE.md)를 따른다. 제목은 `type: 사용자가 보는 변화`로 쓰고, fix는 구현이 아니라 증상과 조건을 쓴다. 본문은 템플릿의 다섯 section(해결하는 문제, 사용자 영향, 왜 이렇게 바꿨는가, 근거, 함께 갱신한 문서)을 순서대로 채우고 주석은 지운다. `gh pr create --body`는 템플릿을 읽지 않으므로 `--body-file`로 같은 구조를 넘긴다. 근거가 된 이슈가 있으면 `Fixes #<number>` 또는 `Related: #<number>`로 함께 포함한다.
- commit, push, PR 생성처럼 저장소나 GitHub 상태를 바꾸는 게시 단계는 사용자가 해당 작업에서 요청하거나 승인한 범위에서 수행한다.
- pre-push는 삭제가 아닌 모든 push에서 typecheck·test·build를 돌린다. 검증한 것과 push되는 것이 같아야 하므로 현재 HEAD가 아닌 ref의 push와 추적 파일의 미커밋 변경을 막는다. `--no-verify`로 우회하지 말고 차단 사유를 고친다.

## merge 뒤 정리
- `gh pr merge`와 `git worktree remove`는 주 디렉터리에서 실행한다. worktree 안에서 부르면 `'main' is already used by worktree`로 막힌다.
- gh 2.101.0에서는 주 디렉터리에서 실행한 `gh pr merge --delete-branch`가 **worktree 디렉터리와 로컬·원격 branch를 함께 지운다**(2026-10-04 실측). worktree에 복사해 둔 `.env`와 `dist/`도 함께 사라진다. 단 추적하지 않는(gitignore되지 않은) 파일이 있으면 worktree 삭제와 로컬 branch 삭제를 건너뛴다(2026-10-04 실측, PR #105). 그때는 남은 파일을 확인한 뒤 `git worktree remove` → `git branch -D` 순서로 정리한다. 실행 뒤 `git worktree list`와 `git branch`로 남은 것이 없는지 확인한다.
- 그보다 낮은 gh에서는 worktree가 살아 있으면 로컬 branch 삭제가 `cannot delete branch ... used by worktree`로 실패한다. 원격 branch는 이미 지워진 뒤라 로컬만 남고, 다음 실행이 낡은 branch를 본다. 그때 정리 순서는 **worktree 제거 → branch 삭제**다.
- 정리 명령에 `git checkout main`을 넣지 않는다. 이미 `main`이어도 PreToolUse hook이 branch 전환으로 보고 명령 전체를 막는다.
