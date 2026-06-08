# Step 0: public-documents

## 읽을 파일

먼저 아래 파일을 읽고 product scope와 공개 문서의 design intent를 이해한다:

- `/docs/PRD.md`
- `/docs/ARCHITECTURE.md`
- `/docs/UI_GUIDE.md`
- `/docs/adr/0001-standalone-extension-repository.md`
- `/docs/adr/0006-fine-grained-pat-for-v1.md`
- `/docs/adr/0010-defer-chrome-web-store-to-v2.md`
- `/docs/adr/0020-user-selected-sync-repository-and-branch.md`
- `/AGENTS.md`
- `/CONTEXT.md`
- 기존 `/README.md`가 있으면 그 내용을 먼저 읽는다.

## 작업

GitHub Public Preview 공개용 문서를 추가하거나 갱신한다.

수정 대상:

- `/README.md`
- `/PRIVACY.md`
- `/SECURITY.md`
- `/LICENSE`

README 요구사항:

- Korean first로 작성한다.
- Chrome Web Store 배포가 아니라 GitHub Public Preview임을 첫 화면에서 명확히 쓴다.
- 다른 사용자가 직접 빌드해 Chrome의 `Load unpacked`로 사용할 수 있는 local unpacked Chrome extension이라고 설명한다.
- 설치 흐름은 아래 세 command/action만 포함한다:
  - `npm install`
  - `npm run build`
  - Chrome Extensions에서 `dist`를 `Load unpacked`
- GitHub Actions artifact, GitHub Release ZIP, Chrome Web Store 설치 안내를 넣지 않는다.
- 지원 범위는 LeetCode와 Programmers의 Accepted Swift/Python3 solution sync로 제한한다.
- fine-grained PAT 권장 안내를 포함한다.
- PAT 권한은 대상 Sync Repository만 선택, Repository permissions `Contents: Read and write`, `Metadata: Read`로 안내한다.
- 공식 GitHub Docs 링크를 포함한다: `https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens`
- 보안/프라이버시 요약은 README에 짧게 두고 세부 내용은 `PRIVACY.md`, `SECURITY.md`로 연결한다.
- GitHub support boundary를 명시한다:
  - bug report, docs/install question은 허용한다.
  - 개인 계정 설정 대행, PAT 값 검토, private repo/session 문제 디버깅은 지원하지 않는다.

PRIVACY 요구사항:

- 처리 데이터, 저장 위치, 전송 대상, 보관/삭제, 비공유/비판매 정책을 설명한다.
- PAT와 Retry Bundle code가 Chrome extension local storage에 저장될 수 있음을 명시한다.
- solution code는 사용자가 선택한 Sync Repository/Sync Branch로만 전송된다고 쓴다.
- LeetCode/Programmers 문제 설명 전문을 저장하지 않는다고 쓴다.

SECURITY 요구사항:

- 취약점 제보 방법을 일반적인 GitHub Issue/maintainer contact 형식으로 안내한다. 실제 secret 값을 요구하지 않는다.
- issue, screenshot, logs에 PAT, token, cookie, session, private solution code를 포함하지 말라고 명시한다.
- 지원 경계는 README와 일관되게 둔다.

LICENSE 요구사항:

- MIT License를 사용한다.
- copyright holder는 `zaehorang`이다.

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
   - `docs/adr/`의 stack decision 안에 머무르는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
3. 이 step에 대해 `phases/11-github-public-preview/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "one-line output summary"`를 추가한다.
   - 현재 runner attempt에서 AC를 통과하지 못함: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- GitHub Release ZIP이나 Chrome Web Store 설치 경로를 README에 넣지 말 것. 이유: Public Preview의 배포 범위가 local build로 제한되어 있다.
- 실제 PAT, token, cookie, session, private repository URL을 예시에 넣지 말 것. 이유: 공개 repository 문서에 secret 또는 private 운영 정보를 남기면 안 된다.
- 사용자가 선택해야 하는 Sync Repository나 Sync Branch를 특정 값으로 고정하지 말 것. 이유: 제품 요구사항은 user-selected destination이다.
- 기존 test를 깨뜨리지 말 것.
