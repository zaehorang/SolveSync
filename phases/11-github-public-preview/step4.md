# Step 4: github-publication

## 읽을 파일

먼저 아래 파일을 읽고 공개 전환 기준을 이해한다:

- `/README.md`
- `/PRIVACY.md`
- `/SECURITY.md`
- `/.gitignore`
- `/docs/PRD.md`
- `/docs/ARCHITECTURE.md`
- `/AGENTS.md`

수정하기 전에 Step 3의 validation summary와 현재 `git status --short`를 확인한다.

## 작업

GitHub repository metadata를 정리하고 `zaehorang/SolveSync`를 public으로 전환한다.

GitHub metadata:

- Description: `Sync accepted LeetCode and Programmers solutions to a selected GitHub repository.`
- Topics:
  - `chrome-extension`
  - `leetcode`
  - `programmers`
  - `github-sync`
  - `typescript`
- Homepage는 비워둔다.

실행 command:

```bash
gh repo edit zaehorang/SolveSync --description "Sync accepted LeetCode and Programmers solutions to a selected GitHub repository." --homepage "" --add-topic chrome-extension --add-topic leetcode --add-topic programmers --add-topic github-sync --add-topic typescript
gh repo edit zaehorang/SolveSync --visibility public
gh repo view zaehorang/SolveSync --json visibility,isPrivate,description,repositoryTopics
```

GitHub Release 생성이나 extension ZIP 첨부는 하지 않는다.

## 인수 기준

```bash
npm test
npm run typecheck
npm run build
gh repo view zaehorang/SolveSync --json visibility,isPrivate,description,repositoryTopics
```

`gh repo view` 결과에서 `visibility`는 `PUBLIC`, `isPrivate`는 `false`, description과 topics는 위 요구사항과 일치해야 한다.

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

- GitHub Release를 만들지 말 것. 이유: Public Preview는 release artifact 제공 범위가 아니다.
- extension ZIP을 첨부하지 말 것. 이유: 사용자는 source에서 직접 build하고 `dist`를 Load unpacked한다.
- Homepage에 임의 URL을 넣지 말 것. 이유: 계획상 homepage는 비워둔다.
- 공개 전환 실패를 성공으로 표시하지 말 것. 이유: visibility 검증이 publication acceptance criteria다.
- 기존 test를 깨뜨리지 말 것.
