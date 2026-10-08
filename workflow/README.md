# workflow

이 저장소에서 **어떻게 일하는지**를 담는 폴더다. 무엇을 만드는지는 `docs/`, 코드는 `src/`·`e2e/`에 있다. 여기의 문서는 사람과 agent가 같이 읽고, `gates/`의 코드가 그중 되돌리기 비싼 규칙을 강제한다.

| 파일 | 답하는 질문 |
|---|---|
| [git-workflow.md](git-workflow.md) | branch, worktree, commit, PR, merge 뒤 정리를 어떻게 하나 |
| [language.md](language.md) | 산문·식별자·용어를 어떤 언어와 표기로 쓰나 |
| [authoring.md](authoring.md) | ADR, spec, platforms, module 문서, investigation, 계획을 어디에 어떻게 추가하나 |
| [commands.md](commands.md) | 무엇을 바꿨을 때 어떤 검증을 돌리고 어떤 문서를 함께 보나 |
| [gates.md](gates.md) | `gates/`의 pre-commit, pre-push, PreToolUse, CI gate가 무엇을 막고 어떻게 바꾸나 |
| `gates/` | 위 gate의 코드와 테스트 |

개인 작업 계획과 메모는 여기가 아니라 `.local/`에 둔다. 추적하지 않는다.
