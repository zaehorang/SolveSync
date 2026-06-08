# Step 1: public-tree-cleanup

## 읽을 파일

먼저 아래 파일을 읽고 공개 repository 표면과 harness 제약을 이해한다:

- `/docs/PRD.md`
- `/docs/ARCHITECTURE.md`
- `/docs/adr/0001-standalone-extension-repository.md`
- `/docs/adr/0010-defer-chrome-web-store-to-v2.md`
- `/docs/adr/0025-separate-harness-validation-and-dirty-recovery-policy.md`
- `/docs/harness/harness_architecture.md`가 아직 tracked 상태이면 읽는다.
- `/README.md`
- `/PRIVACY.md`
- `/SECURITY.md`
- `/LICENSE`
- `/AGENTS.md`

수정하기 전에 Step 0에서 작성된 공개 문서를 주의 깊게 읽는다.

## 작업

Public Preview에서 공개하지 않을 내부 workflow 산출물을 Git tracking에서 제거하되 로컬 working tree에는 유지한다.

수정 대상:

- `/.gitignore`
- Git index
- `/docs/adr/0025-separate-harness-validation-and-dirty-recovery-policy.md`

`.gitignore`에 아래 내부 workflow 경로를 추가한다:

- `.agents/`
- `.codex/`
- `phases/`
- `docs/harness/`
- `scripts/execute.py`
- `scripts/harness/`
- `scripts/harness_tests/`
- `scripts/harness_self_test.py`
- `scripts/quality_gate.py`

Git tracking에서 아래 경로를 제거한다. 로컬 파일 삭제가 아니라 untrack이어야 하므로 `git rm --cached`를 사용한다:

- `.agents/`
- `.codex/`
- `phases/`
- `docs/harness/`
- `scripts/execute.py`
- `scripts/harness/`
- `scripts/harness_tests/`
- `scripts/harness_self_test.py`
- `scripts/quality_gate.py`
- `docs/adr/0025-separate-harness-validation-and-dirty-recovery-policy.md`

중요한 runner 제약:

- 이 step은 현재 harness runner가 사용하는 `phases/index.json`과 `phases/11-github-public-preview/index.json` metadata를 업데이트해야 한다.
- runner metadata commit이 active phase index를 다시 stage해야 할 수 있다. 만약 `phases/` 전체 ignore 때문에 runner metadata staging이 실패할 위험이 있으면, cleanup은 가능한 tracked 내부 파일 제거를 먼저 수행하고 현재 runner metadata 파일만 최종 cleanup 대상으로 남겨라.
- active phase metadata를 남기는 경우에는 `summary`에 그 사실과 이유를 명시한다. runner 완료 후 public branch finalization에서 제거할 수 있어야 한다.

유지할 공개 표면:

- `src/`
- extension config와 package files
- icons와 brand assets
- `AGENTS.md`
- `CONTEXT.md`
- 제품 문서: `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/UI_GUIDE.md`, `docs/MANUAL_VALIDATION.md`, `docs/DEFERRED_WORK.md`, `docs/CHROME_WEB_STORE_PRELAUNCH.md`, `docs/adr/`
- `scripts/verify_extension_build.mjs`

## 인수 기준

```bash
npm run typecheck
npm test
npm run build
git ls-files .agents .codex docs/harness scripts/execute.py scripts/harness scripts/harness_tests scripts/harness_self_test.py scripts/quality_gate.py docs/adr/0025-separate-harness-validation-and-dirty-recovery-policy.md
```

마지막 `git ls-files` command는 제거 대상이 tracked에서 사라졌음을 보여야 한다. 현재 runner metadata 파일이 남아 있어야 해서 `phases/` 전체가 완전히 사라지지 못한 경우에는 그 사유를 summary에 쓴다.

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

- `rm -r`로 내부 workflow 파일을 삭제하지 말 것. 이유: 공개 repo에서는 untracked여야 하지만 로컬 working tree에는 계속 필요하다.
- `dist/`, `node_modules/`, coverage output, build artifact를 stage하지 말 것. 이유: 공개 준비 commit 범위에 build artifact가 포함되면 안 된다.
- 제품 source file을 cleanup 목적으로 삭제하지 말 것. 이유: 공개 표면에는 extension source가 유지되어야 한다.
- 기존 test를 깨뜨리지 말 것.
