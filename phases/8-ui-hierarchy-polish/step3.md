# Step 3: integration-qa

## 읽을 파일

먼저 아래 파일을 읽고 이번 phase의 완료 조건과 수동 검증 문서를 확인한다:

- `AGENTS.md`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/UI_GUIDE.md`
- `docs/MANUAL_VALIDATION.md`
- `docs/adr/0004-vanilla-dom-ui.md`
- `docs/adr/0023-separate-iife-content-script-bundle.md`
- `phases/8-ui-hierarchy-polish/index.json`
- `src/popup/index.ts`
- `src/popup/styles.css`
- `src/options/index.ts`
- `src/options/styles.css`
- `src/popup/popup.test.ts`
- `src/options/options.test.ts`

수정하기 전에 Step 0, 1, 2 summary와 변경 파일을 확인한다.

## 작업

이번 phase의 통합 QA를 수행하고 필요한 작은 마감 수정만 한다.

감사할 요구사항:

- 정보 중복
  - 같은 history cell에서 language가 group badge와 row badge에 반복 노출되지 않는가?
  - repository/branch가 상단 설정 요약 밖의 Recent Sync History group/row meta에 반복되지 않는가?
  - branch가 최근 푼 문제마다 반복되는 노이즈가 제거됐는가?
- Recent sync 위계
  - 한 문제의 시작/끝 cell boundary가 명확한가?
  - 문제 단위 정보와 language별 sync row의 레벨이 구분되는가?
  - Commit/File link가 어느 language row에 속하는지 알 수 있는가?
- 레이아웃/공간 사용
  - Popup status card가 scroll content를 가리지 않는가?
  - Popup 첫 화면에서 Recent Sync History가 과도하게 밀리지 않는가?
  - Options Save controls가 desktop/mobile 모두에서 자연스러운 수평/수직 위계를 갖는가?
- 조작성/일관성
  - Popup Commit/File link touch target이 충분한가?
  - Popup Auto Sync와 Options Auto Sync가 switch 계열로 일관되는가?
  - Options 360px mobile에서 hidden Auto Sync input으로 horizontal overflow가 생기지 않는가?
  - 긴 문제명/저장소명이 layout을 깨지 않고 스캔 가능한가?

수동 검증 문서:

- `docs/MANUAL_VALIDATION.md`에 이번 UI 회귀를 확인할 짧은 관찰 포인트가 빠져 있으면 갱신한다.
- 문서 갱신은 짧고 검증 절차 중심이어야 한다. 제품 세부 규칙을 AGENTS.md에 복제하지 않는다.

권장 runtime 확인:

- 가능하면 Vite dev server 또는 built HTML을 사용해 popup/options를 380px/600px, 360px mobile 근처 viewport에서 확인한다.
- Browser automation이 불가능하면 그 사실을 summary에 남기고 DOM/CSS/test evidence로 검증한다.

## 인수 기준

```bash
npm run typecheck
npm test
npm run build
```

## 검증

1. 인수 기준 command를 실행한다.
2. `npm run build`가 content IIFE bundle 검증까지 통과하는지 확인한다.
3. Architecture checklist를 확인한다:
   - 작업이 `ARCHITECTURE.md`의 Popup/Options 책임을 넘지 않는가?
   - `docs/adr/0004-vanilla-dom-ui.md`와 `docs/adr/0023-separate-iife-content-script-bundle.md`를 위반하지 않는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
4. 이 step에 대해 `phases/8-ui-hierarchy-polish/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "Integration QA completed for Popup/Options hierarchy polish"`를 추가한다.
   - 현재 runner attempt에서 AC를 통과하지 못함: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- 큰 refactor를 시작하지 말 것. 이유: 이 step은 통합 QA와 작은 마감 수정만 담당한다.
- 제품 scope를 넓히지 말 것. 이유: 일반 수동 sync, OAuth, 새 Coding Platform 지원은 v1 범위 밖이다.
- `dist/`, coverage output, `node_modules/`를 커밋하지 말 것. 이유: build artifact와 dependency output은 커밋 대상이 아니다.
- README를 수정하지 말 것. 이유: 사용자가 명시적으로 요청하지 않았다.
- 하위 agent가 git commit을 만들지 말 것. 이유: `scripts/execute.py`가 step commit을 관리한다.
- 기존 test를 깨뜨리지 말 것.
