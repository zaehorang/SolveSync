# Language

저장소 안에서 개발자와 agent가 주고받는 글의 언어 규칙이다. 사용자에게 보이는 UI 문구는 여기가 아니라 [`docs/UI_GUIDE.md`](../docs/UI_GUIDE.md)의 locale 규칙을 따른다.

- 산문은 한국어로 쓴다. `docs/`, `workflow/`, 코드 주석과 docstring, commit message subject, PR 제목과 본문, GitHub Issue 코멘트가 여기에 해당한다.
- `workflow/gates/`의 차단 사유, JSON schema description, `.claude/`의 agent와 skill 문서, 그리고 사람이나 agent가 읽는 런타임 메시지(hook 차단 사유, 검증 실패 메시지)도 한국어로 쓴다.
- 식별자는 번역하지 않는다. 파일 경로, 함수/변수 이름, branch 이름, conventional commit type(`feat:`, `fix:` 등), [`CONTEXT.md`](../CONTEXT.md)가 정의한 도메인 용어는 원문 그대로 쓴다.
- 도메인 용어는 `CONTEXT.md`의 표기를 따르고, 같은 개념을 한국어로 임의 번역해 새 용어를 만들지 않는다.
