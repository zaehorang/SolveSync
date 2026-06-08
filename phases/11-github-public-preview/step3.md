# Step 3: public-preview-validation

## 읽을 파일

먼저 아래 파일을 읽고 validation scope를 이해한다:

- `/docs/PRD.md`
- `/docs/ARCHITECTURE.md`
- `/docs/MANUAL_VALIDATION.md`
- `/README.md`
- `/PRIVACY.md`
- `/SECURITY.md`
- `/.gitignore`
- `/AGENTS.md`

수정하기 전에 Step 0-2에서 변경된 문서와 cleanup 결과를 읽는다.

## 작업

GitHub Public Preview 공개 직전 검증을 수행하고, 발견된 작은 문서/ignore 문제만 수정한다.

검증 항목:

- 공개 문서 secret scan:
  - PAT, token, cookie, session 관련 실제 값이 없는지 확인한다.
  - `zaehorang/Swift_Algorithm` 또는 `Swift_Algorithm`이 남아 있지 않은지 확인한다.
  - private 운영 정보가 공개 문서에 남아 있지 않은지 확인한다.
- Git 추적 상태 확인:
  - 내부 workflow 파일이 tracked에서 제거됐는지 `git ls-files`로 확인한다.
  - 로컬에는 ignored 파일로 남아 있는지 `git status --ignored --short`로 확인한다.
- 기능 검증:
  - `npm test`
  - `npm run typecheck`
  - `npm run build`
- staging 검증:
  - `git diff --cached --name-only`를 확인해 공개 준비 파일만 포함됐는지 본다.

허용되는 수정:

- 문서에서 남은 실제 repository명이나 private 운영 문구 제거.
- `.gitignore`에 빠진 내부 workflow 경로 추가.
- README/PRIVACY/SECURITY의 broken link 또는 공개 범위 불일치 수정.

## 인수 기준

```bash
npm test
npm run typecheck
npm run build
rg -n "zaehorang/Swift_Algorithm|Swift_Algorithm" README.md PRIVACY.md SECURITY.md AGENTS.md CONTEXT.md docs package.json manifest.json
git ls-files .agents .codex docs/harness scripts/execute.py scripts/harness scripts/harness_tests scripts/harness_self_test.py scripts/quality_gate.py docs/adr/0025-separate-harness-validation-and-dirty-recovery-policy.md
git status --ignored --short
git diff --cached --name-only
```

`rg`는 match가 없어야 한다. `git ls-files`는 제거 대상 내부 workflow path를 출력하지 않아야 한다. `git status --ignored --short`는 내부 workflow 파일이 ignored local file로 남아 있음을 확인하는 용도다.

## 검증

1. 인수 기준 command를 실행한다.
2. Architecture checklist를 확인한다:
   - 작업이 `ARCHITECTURE.md`의 directory structure를 따르는가?
   - `docs/adr/`의 stack decision 안에 머무르는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
3. 이 step에 대해 `phases/11-github-public-preview/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "one-line output summary"`를 추가한다.
   - 현재 runner attempt에서 AC를 통과하지 못함: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- 검증 중 발견한 범위 밖 product refactor를 하지 말 것. 이유: 공개 준비 branch는 문서와 tree cleanup에 집중해야 한다.
- 실제 PAT, token, cookie, session 값을 검증용으로 파일에 쓰지 말 것. 이유: 공개 전 secret scan 대상이 된다.
- build output을 commit에 포함하지 말 것. 이유: Public Preview는 source build 방식이며 release artifact를 제공하지 않는다.
- 기존 test를 깨뜨리지 말 것.
