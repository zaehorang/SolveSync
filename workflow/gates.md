# gates

되돌리기 비싼 저장소 변경을 commit·도구 호출·CI 시점에 차단하는 gate 코드다. 코드는 [`gates/`](gates/)에 있다. 구현을 대신하지 않으며, 규칙이 왜 있는지는 [git-workflow](git-workflow.md)가 설명한다.

## Owns
- [`gates/policy.py`](gates/policy.py)의 부수효과 없는 차단 규칙
- [`gates/hooks/pre-commit`](gates/hooks/pre-commit)의 commit gate
- [`gates/hooks/pre-push`](gates/hooks/pre-push)의 PR 전 검증 gate
- [`gates/hooks/claude_pretooluse.py`](gates/hooks/claude_pretooluse.py)의 대화형 조기 경보
- [`gates/ci_gate.py`](gates/ci_gate.py)의 clone 환경 secret·산출물 검증

## Common changes
- 새 clone에 hook 설치 → 저장소 루트에서 `git config core.hooksPath workflow/gates/hooks`를 실행한다. 설정은 저장소 공통이고 hook 경로는 각 worktree 기준으로 해석되므로 worktree마다 다시 설정하지 않는다.
- 차단 규칙 변경 → `gates/policy.py`와 [`gates/tests/test_policy.py`](gates/tests/test_policy.py)를 같은 commit에서 수정한다.
- CI git 출력 해석 변경 → `gates/ci_gate.py`와 [`gates/tests/test_ci_gate.py`](gates/tests/test_ci_gate.py)의 임시 저장소 회귀 test를 갱신한다.
- hook 배선 변경 → [`.claude/settings.json`](../.claude/settings.json), [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)과 실제 실행 시점을 함께 확인한다.
- 폴더 이동 → hooksPath, settings.json, ci.yml, pre-push의 범위 판정 문자열, 테스트 안의 경로 문자열을 함께 바꾼다.

```bash
git config core.hooksPath workflow/gates/hooks
python3 -m unittest discover -s workflow/gates/tests -t workflow/gates
```

## Non-obvious
- 주의: gate는 secret, 남의 worktree 파괴, 산출물 commit처럼 되돌릴 수 없는 것을 막는 것이 원칙이다. 예외로 전역 npm 설치(`npm install -g`)도 막는다. worktree 밖 환경을 바꾸기 때문이다.
- 주의: PreToolUse가 막는 것은 금지 경로 쓰기, `git commit --no-verify`/`-n`과 `git push --no-verify` 우회, 주 디렉터리에서의 branch 전환, 전역 npm 설치다. 게시(`git push`, `gh pr`)와 저장소 밖 경로 읽기는 막지 않는다.
- 주의: CI gate는 base 이후의 commit을 하나씩 검사한다. 한 commit에서 넣고 다음 commit에서 지운 secret도 history에 남으므로 잡는다.
- 주의: pre-commit은 되돌릴 수 없는 저장소 보호 규칙의 최후 방어선이고 PreToolUse는 그보다 앞선 조기 경보다. pre-push는 typecheck·Vitest·build를 PR 전 실행하며, push 범위에 `workflow/gates/`가 있거나 판정하지 못하면 자체 테스트도 실행한다. 자체 테스트를 pre-commit에 남기지 않는 이유는 CI가 모든 PR에서 이를 다시 실행하기 때문이다. CI는 hook이 없는 clone에서 secret과 산출물 경로를 다시 검사한다.
- 주의: gate가 없는 base에서 만든 worktree에는 commit gate가 없으므로 gate는 base branch에 있어야 한다.
- 주의: `--no-verify`로 우회하지 않고 차단 사유를 고친다.
- 주의: 파일 존재만 검사하는 gate는 빈 파일 하나로 통과하므로 보호 규칙으로 추가하지 않는다.
- 주의: 차단 사유는 지시문으로 쓴다. hook이 사유를 그대로 모델에게 돌려주므로 무엇이 잘못됐는지가 아니라 대신 무엇을 하라고 적는다.
- Why: `policy.py`가 신뢰 경계이므로 규칙 변경에는 실행 가능한 회귀 test가 필요하다.
- 주의: `.claude/settings.json`·`.codex/hooks.json`의 SessionEnd 훅은 이 폴더 소유가 아니다. 세션 기록을 다른 모델이 검토해 하네스 개선 제안을 `.local/harness-backlog/`에 남기는 `harness-backlog` 스킬의 것이고, 스크립트는 주 디렉터리의 `.claude/skills/harness-backlog/`에 있다(git 제외). 막는 gate가 아니라 세션 종료를 막지 않는다.

## Dependencies
- imports: Python standard library만 사용
- imported by: pre-commit hook, Claude Code PreToolUse와 GitHub Actions CI
- 계약 문서: [git-workflow](git-workflow.md), [ARCHITECTURE](../docs/ARCHITECTURE.md), [Manual Validation](../docs/MANUAL_VALIDATION.md)
