# harness

되돌리기 비싼 저장소 변경을 commit·도구 호출·CI 시점에 차단하는 gate module이다.

## Owns
- [`policy.py`](policy.py)의 부수효과 없는 차단 규칙
- [`hooks/pre-commit`](hooks/pre-commit)의 commit gate
- [`hooks/pre-push`](hooks/pre-push)의 PR 전 검증 gate
- [`hooks/claude_pretooluse.py`](hooks/claude_pretooluse.py)의 대화형 조기 경보
- [`ci_gate.py`](ci_gate.py)의 clone 환경 secret·산출물 검증

## Common changes
- 새 clone에 hook 설치 → 저장소 루트에서 `git config core.hooksPath harness/hooks`를 실행한다.
- 차단 규칙 변경 → `policy.py`와 [`tests/test_policy.py`](tests/test_policy.py)를 같은 commit에서 수정한다.
- CI git 출력 해석 변경 → `ci_gate.py`와 [`tests/test_ci_gate.py`](tests/test_ci_gate.py)의 임시 저장소 회귀 test를 갱신한다.
- hook 배선 변경 → [`.claude/settings.json`](../.claude/settings.json), [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)과 실제 실행 시점을 함께 확인한다.

```bash
git config core.hooksPath harness/hooks
python3 -m unittest discover -s harness/tests -t harness
```

## Non-obvious
- 주의: gate는 secret, 남의 worktree 파괴, 산출물 commit처럼 되돌릴 수 없는 것만 막는다.
- 주의: pre-commit은 되돌릴 수 없는 저장소 보호 규칙의 최후 방어선이고 PreToolUse는 그보다 앞선 조기 경보다. pre-push는 typecheck·Vitest·build를 PR 전 실행하며, push 범위에 `harness/`가 있거나 판정하지 못하면 자체 테스트도 실행한다. 자체 테스트를 pre-commit에 남기지 않는 이유는 CI가 모든 PR에서 이를 다시 실행하기 때문이다. CI는 hook이 없는 clone에서 secret과 산출물 경로를 다시 검사한다.
- 주의: gate가 없는 base에서 만든 worktree에는 commit gate가 없으므로 gate는 base branch에 있어야 한다.
- 주의: `--no-verify`로 우회하지 않고 차단 사유를 고친다.
- 주의: 파일 존재만 검사하는 gate는 빈 파일 하나로 통과하므로 보호 규칙으로 추가하지 않는다.
- Why: `policy.py`가 신뢰 경계이므로 규칙 변경에는 실행 가능한 회귀 test가 필요하다.
- 주의: `.claude/settings.json`·`.codex/hooks.json`의 SessionEnd 훅은 이 디렉터리 소유가 아니다. 세션 기록을 다른 모델이 검토해 하네스 개선 제안을 `.local/harness-backlog/`에 남기는 `harness-backlog` 스킬의 것이고, 스크립트는 주 디렉터리의 `.claude/skills/harness-backlog/`에 있다(git 제외). 막는 gate가 아니라 세션 종료를 막지 않는다.

## Dependencies
- imports: Python standard library만 사용
- imported by: pre-commit hook, Claude Code PreToolUse와 GitHub Actions CI
- 계약 문서: [root Git Workflow](../AGENTS.md), [ARCHITECTURE](../docs/ARCHITECTURE.md), [Manual Validation](../docs/MANUAL_VALIDATION.md)
