# e2e

빌드된 확장을 실제 Chrome에 로드해 제품 밖에서 검증하는 module이다. 캡처 도구, fixture, Verification Profile, Platform E2E Driver를 소유한다. 계층별 설명과 실행 절차는 [`README.md`](README.md), 플랫폼 계약과 실측값은 [`docs/platforms/`](../docs/platforms/)를 따른다. 이 파일은 그 둘에 없는 비직관적 규칙만 담는다.

## Owns
- Platform E2E Driver([`drivers/`](drivers/))와 세 플랫폼이 함께 지키는 계약([`drivers/types.ts`](drivers/types.ts))
- 캡처 도구([`capture/`](capture/)) — 플랫폼별 제출 driver, recorder, redaction
- 실제 page에서 캡처한 sanitized DOM fixture와 검증용 풀이([`fixtures/`](fixtures/))
- 확장 로드, route 가로채기, 확장 page 메시징, Verification Profile, Verification Repository, 자격증명([`support/`](support/))

## Common changes
- 새 Coding Platform 추가 → [`drivers/`](drivers/)에 driver 파일 하나를 만들고 [`drivers/index.ts`](drivers/index.ts)에 한 줄로 등록한다. 등록한 것만 spec이 돈다.
- fixture 갱신 → `npm run e2e:capture`로 다시 캡처한다. 손으로 고치지 않는다. 실측이 아닌 fixture는 이 계층이 없애려는 문제 그 자체다.
- 계층을 추가하거나 실행 조건을 바꿈 → [`README.md`](README.md)의 해당 절과 CI job 배선을 함께 본다.

```bash
npm run build && npm run e2e
```

`npm run e2e`는 secret 없이 도는 계층만 실행한다. 로그인 세션이나 실제 제출이 필요한 계층은 env guard로 스스로 건너뛰므로, 건너뛴 것을 통과로 읽지 않는다.

## Non-obvious
- 주의: **실제 page의 사실을 추측하지 않는다.** 사용자 Chrome은 세 플랫폼에 로그인돼 있으므로 `mcp__claude-in-chrome__javascript_tool`로 직접 잰다. Playwright 로그인이나 채점 제출을 태우지 않고 selector, DOM 구조, sandbox 제약을 확인할 수 있다. 추측한 selector를 코드에 박는 것이 이 계층이 없애려는 문제 그 자체다.
- 주의: 그 도구가 raw HTML이나 함수 소스를 돌려주면 분류기가 `[BLOCKED: ...]`로 막는다. `outerHTML` 대신 tag·id·class·text 같은 구조화된 필드로 뽑는다.
- 주의: 새 worktree에서 Playwright를 돌리기 전에 `npm run build`. `dist/`가 없으면 확장 로드가 test timeout까지 조용히 멈춘다.
- 주의: `.env`는 worktree 안에 있어야 한다. [`playwright.config.ts`](../playwright.config.ts)가 `import.meta.dirname` 기준으로 읽으므로 주 디렉터리에 두면 조용히 무시된다.
- 주의: Playwright의 click과 wait는 기본적으로 test timeout까지 기다린다. 실제 page 조작에는 제한을 걸거나 상태를 먼저 단언한다 — 로그아웃 상태에서 10분씩 두 번 날렸다.
- 주의: **실패 단언에 그때 실제로 본 값을 담는다.** "제목이 없다"는 bot 차단과 page 구조 변경을 구분하지 못한다. `document.title`을 함께 찍자마자 원인이 드러났다.
- 주의: **제출 앞의 두 guard를 우회하지 않는다.** editor가 넣으려던 code를 실제로 들고 있는지 확인하는 것과, SWEA가 채점 제출 없이 먼저 실행해 예제와 대조하는 것이다. 둘 다 실제로 잘못된 제출을 여러 번 막았다.
- Why: 제출은 되돌릴 수 없고 SWEA는 횟수 상한이 있다. 이 계층에서 되돌릴 수 없는 것은 제출뿐이라 guard도 거기에만 둔다.
- 주의: **solution code는 editor DOM, 제출 결과 panel, hydration `<script>` 세 경로로 샌다.** 어느 것도 `<textarea>` 비우기로는 잡히지 않는다. 새 플랫폼을 추가하면 셋을 다시 확인한다. 저장 직전 검사는 마지막 문이지 첫 문이 아니다.

## Dependencies
- imports: `dist/`의 빌드 산출물(`src/`가 아니다)과 Playwright
- imported by: 없다. vite 진입점에 걸리지 않아 확장 번들에 절대 포함되지 않으므로, 제품이 쓰지 않는 selector가 여기에만 존재할 수 있다.
- 타입: [`tsconfig.json`](tsconfig.json)으로 따로 검사한다. root `tsconfig.json`은 `types: ["chrome", "vitest/globals"]`라 Playwright 타입과 한 program에 섞을 수 없다.
- 계약 문서: [실행 절차와 계층](README.md), [Coding Platform 공통 계약](../docs/platforms/README.md), [Manual Validation](../docs/MANUAL_VALIDATION.md)
