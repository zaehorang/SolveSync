# e2e Agent Guide

캡처 도구, fixture, Verification Profile, Platform E2E Driver를 소유한다. 플랫폼 계약과 실측값은 [`docs/platforms/`](../docs/platforms/), 실행 절차는 [`README.md`](README.md)를 따른다. 이 파일은 그 둘에 없는 비직관적 규칙만 담는다.

- **실제 page의 사실을 추측하지 않는다.** 사용자 Chrome은 세 플랫폼에 로그인돼 있으므로 `mcp__claude-in-chrome__javascript_tool`로 직접 잰다. Playwright 로그인이나 채점 제출을 태우지 않고 selector, DOM 구조, sandbox 제약을 확인할 수 있다. 추측한 selector를 코드에 박는 것이 이 계층이 없애려는 문제 그 자체다.
- 그 도구가 raw HTML이나 함수 소스를 돌려주면 분류기가 `[BLOCKED: ...]`로 막는다. `outerHTML` 대신 tag·id·class·text 같은 구조화된 필드로 뽑는다.
- 새 worktree에서 Playwright를 돌리기 전에 `npm run build`. `dist/`가 없으면 확장 로드가 test timeout까지 조용히 멈춘다.
- Playwright의 click과 wait는 기본적으로 test timeout까지 기다린다. 실제 page 조작에는 제한을 걸거나 상태를 먼저 단언한다 — 로그아웃 상태에서 10분씩 두 번 날렸다.
- **실패 단언에 그때 실제로 본 값을 담는다.** "제목이 없다"는 bot 차단과 page 구조 변경을 구분하지 못한다. `document.title`을 함께 찍자마자 원인이 드러났다.
- `.env`는 worktree 안에 있어야 한다. `playwright.config.ts`가 `import.meta.dirname` 기준으로 읽으므로 주 디렉터리에 두면 조용히 무시된다.
- **제출 앞의 두 guard를 우회하지 않는다.** editor가 넣으려던 code를 실제로 들고 있는지 확인하는 것과, SWEA가 채점 제출 없이 먼저 실행해 예제와 대조하는 것이다. 제출은 되돌릴 수 없고 SWEA는 횟수 상한이 있다. 둘 다 실제로 잘못된 제출을 여러 번 막았다.
- **solution code는 editor DOM, 제출 결과 panel, hydration `<script>` 세 경로로 샌다.** 어느 것도 `<textarea>` 비우기로는 잡히지 않는다. 새 플랫폼을 추가하면 셋을 다시 확인한다. 저장 직전 검사는 마지막 문이지 첫 문이 아니다.
