# harness

되돌리기 비싼 저장소 변경을 commit·도구 호출·CI 시점에 차단하는 gate module이다.

## Owns
- [`policy.py`](policy.py)의 부수효과 없는 차단 규칙
- [`hooks/pre-commit`](hooks/pre-commit)의 commit gate
- [`hooks/claude_pretooluse.py`](hooks/claude_pretooluse.py)의 대화형 조기 경보
- [`ci_gate.py`](ci_gate.py)의 clone 환경 secret·산출물 검증

## Common changes
- 차단 규칙 변경 → `policy.py`와 [`tests/test_policy.py`](tests/test_policy.py)를 같은 commit에서 수정한다.
- CI git 출력 해석 변경 → `ci_gate.py`와 [`tests/test_ci_gate.py`](tests/test_ci_gate.py)의 임시 저장소 회귀 test를 갱신한다.
- hook 배선 변경 → [`.claude/settings.json`](../.claude/settings.json), [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)과 실제 실행 시점을 함께 확인한다.

```bash
python3 -m unittest discover -s harness/tests -t harness
```

## Non-obvious
- 주의: gate는 secret, 남의 worktree 파괴, 산출물 commit처럼 되돌릴 수 없는 것만 막는다.
- 주의: `--no-verify`로 우회하지 않고 차단 사유를 고친다.
- 주의: 파일 존재만 검사하는 gate는 빈 파일 하나로 통과하므로 보호 규칙으로 추가하지 않는다.
- Why: `policy.py`가 신뢰 경계이므로 규칙 변경에는 실행 가능한 회귀 test가 필요하다.

## Dependencies
- imports: Python standard library만 사용
- imported by: pre-commit hook, Claude Code PreToolUse와 GitHub Actions CI
- 계약 문서: [root Git Workflow](../CLAUDE.md), [ARCHITECTURE](../docs/ARCHITECTURE.md), [Manual Validation](../docs/MANUAL_VALIDATION.md)
