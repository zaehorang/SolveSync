# Step 2: repository-reference-scrub

## 읽을 파일

먼저 아래 파일을 읽고 사용자-facing 문서와 internal docs 경계를 이해한다:

- `/docs/PRD.md`
- `/docs/ARCHITECTURE.md`
- `/docs/MANUAL_VALIDATION.md`
- `/docs/CHROME_WEB_STORE_PRELAUNCH.md`
- `/docs/adr/0020-user-selected-sync-repository-and-branch.md`
- `/docs/adr/0026-domain-naming-v4-storage-runtime-and-catalog-migration.md`
- `/README.md`
- `/PRIVACY.md`
- `/SECURITY.md`
- `/AGENTS.md`

수정하기 전에 Step 1의 cleanup 결과와 `git status --short`를 확인한다.

## 작업

공개로 남는 문서에서 실제 운영 또는 개인 검증 repository 이름을 예시 repository로 치환한다.

주요 치환:

- `zaehorang/Swift_Algorithm` 같은 실제 Sync Repository명은 `your-name/algorithm-solutions` 또는 `example-user/algorithm-solutions`로 바꾼다.

검토 범위:

- `README.md`
- `PRIVACY.md`
- `SECURITY.md`
- `AGENTS.md`
- `CONTEXT.md`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/UI_GUIDE.md`
- `docs/MANUAL_VALIDATION.md`
- `docs/DEFERRED_WORK.md`
- `docs/CHROME_WEB_STORE_PRELAUNCH.md`
- `docs/adr/`
- `package.json`
- `manifest.json`

문서 의미 유지:

- domain naming migration이나 manual validation에서 과거 내부 검증 대상이 필요했던 문장은 공개 예시 흐름으로 다시 써라.
- 제품 요구사항인 user-selected Sync Repository/Sync Branch 원칙은 더 강하게 유지한다.
- PAT, token, cookie, session이라는 보안 용어는 문서 정책 설명에 필요하므로 무조건 삭제하지 말고 실제 secret 값이나 실제 private repo 식별자만 제거한다.

## 인수 기준

```bash
npm run typecheck
npm test
npm run build
rg -n "zaehorang/Swift_Algorithm|Swift_Algorithm" README.md PRIVACY.md SECURITY.md AGENTS.md CONTEXT.md docs package.json manifest.json
```

마지막 `rg` command는 match가 없어야 한다.

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

- PAT, token, cookie, session 같은 보안 용어를 정책 문서에서 무조건 삭제하지 말 것. 이유: 공개 문서에는 어떤 secret을 다루지 말아야 하는지 설명해야 한다.
- `zaehorang/SolveSync` repository 이름은 공개 대상 repo 자체를 가리키는 문맥에서 제거하지 말 것. 이유: 이번 공개 대상이 해당 repo다.
- 제품 동작을 바꾸는 source code 변경을 하지 말 것. 이유: 이 step은 공개 문서 scrub에 한정된다.
- 기존 test를 깨뜨리지 말 것.
