# Step 0: project-scaffold

## 읽을 파일

먼저 아래 파일을 읽고 architecture와 design intent를 이해한다:

- `/AGENTS.md`
- `/docs/PRD.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- `/docs/UI_GUIDE.md`
- `/docs/MANUAL_VALIDATION.md`
- `/phases/0-mvp-extension/index.json`

수정하기 전에 현재 repository root의 파일 목록을 확인한다.

## 작업

Chrome Extension Manifest V3, TypeScript strict mode, Vite, npm, Vitest 기반의 최소 프로젝트 뼈대를 만든다.

생성 또는 수정할 파일:

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `vitest.config.ts`
- `vite.config.ts`
- `manifest.json`
- `src/background/index.ts`
- `src/content/index.ts`
- `src/options/index.html`
- `src/options/index.ts`
- `src/options/styles.css`
- `src/popup/index.html`
- `src/popup/index.ts`
- `src/popup/styles.css`
- `src/shared/index.ts`
- 필요한 경우 `src/vite-env.d.ts`

요구사항:

- `package.json`은 npm scripts로 `typecheck`, `test`, `build`를 제공한다.
- dependency manager는 npm을 사용한다. `pnpm`, `yarn` 설정을 만들지 않는다.
- TypeScript는 strict mode로 설정한다.
- Vite build는 MV3 extension entry를 `dist/`로 산출해야 한다.
- Manifest 권한은 `storage`, host permissions `https://leetcode.com/*`, `https://api.github.com/*`, content script match `https://leetcode.com/problems/*`만 사용한다.
- Options, Popup, Content, Background entry가 compile 가능한 최소 placeholder로 연결되어야 한다.
- `dist/`, `node_modules/`, coverage output은 gitignore 대상이어야 한다. 기존 `.gitignore`를 확인하고 부족하면 보강한다.
- 이 step에서는 업무 규칙 구현을 하지 않는다. 다음 step들이 확장할 수 있는 compile 가능한 skeleton만 만든다.
- `npm install`을 실행해 `package-lock.json`과 local dependencies를 준비한다. 네트워크나 registry 접근이 불가능하면 해당 step을 `blocked`로 기록한다.

## 인수 기준

```bash
npm run typecheck
npm test
npm run build
```

## 검증

1. 인수 기준 command를 실행한다.
2. Architecture checklist를 확인한다:
   - 작업이 `ARCHITECTURE.md`의 directory structure를 따르는가?
   - `ADR.md`의 stack decision 안에 머무르는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
3. 이 step에 대해 `phases/0-mvp-extension/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "project scaffold with MV3 Vite TypeScript Vitest skeleton"`를 추가한다.
   - 3회 수정 시도 후에도 실패: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- README를 수정하지 말 것. 이유: AGENTS.md는 사용자가 명시 요청하지 않는 한 README 수정을 금지한다.
- 실제 GitHub PAT, LeetCode cookie, session token 예시를 넣지 말 것. 이유: CRITICAL 보안 규칙 위반이다.
- React, Vue, Svelte 같은 UI framework를 추가하지 말 것. 이유: ADR-004는 Vanilla DOM UI를 결정했다.
- GitHub OAuth 관련 코드를 만들지 말 것. 이유: v1 범위 밖이다.
- 기존 test를 깨뜨리지 말 것.
