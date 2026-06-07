# Chrome Web Store 배포 전 체크리스트

> **Description**: SolveSync를 Chrome Web Store에 Public으로 제출하기 전에 준비해야 할 작업을 Codex와 사용자 역할로 나눈 실행 문서다.

Last checked against official Chrome Web Store docs: 2026-06-05.

## 배포 목표
- 첫 Chrome Web Store 제출은 Public 배포를 목표로 한다.
- Privacy Policy는 Notion 공개 페이지 URL을 사용한다.
- GitHub OAuth 전환은 이번 배포 전 범위에 넣지 않고, 현재 fine-grained PAT 방식으로 제출한다.
- 실제 로그인 세션과 GitHub PAT가 필요한 검증은 사용자가 수행한다.

## 진행 완료
- 앱 로고 방향은 `Sync Tray`로 확정했다.
- 수정 가능한 로고 원본은 `assets/brand/solvesync-icon.svg`와 `assets/brand/solvesync-toolbar-icon.svg`에 둔다.
- Chrome extension icon PNG는 `icons/icon-16.png`, `icons/icon-32.png`, `icons/icon-48.png`, `icons/icon-128.png`로 생성했다.
- `manifest.json`에 `icons`와 `action.default_icon`을 추가했다.
- Vite build가 `icons/`를 `dist/icons/`로 복사하도록 설정했다.
- 128px 아이콘은 sync tray 컨셉을 유지하고, 16/32/48px toolbar 아이콘은 작은 크기 가독성을 위해 단순화한 원본에서 생성한다.

## 현재 부족한 것
- Store listing용 스크린샷과 small promo tile이 없다.
- Chrome Web Store listing 문구, 권한 설명, Privacy 탭 답변, reviewer test instructions가 없다.
- Notion 공개 Privacy Policy가 아직 없다.
- `package:chrome` 같은 제출 ZIP 생성 스크립트가 없다.
- 제품 문서와 UI copy 일부가 아직 local unpacked v1 기준이다.
- Chrome Web Store Developer 계정 상태, 2-Step Verification, publisher 정보, Trader/Non-Trader 선언이 아직 확인되지 않았다.

## Codex가 할 일
### 1. 문서와 제품 copy 정리
- `docs/PRD.md`의 릴리즈 전략과 v1 제외 사항을 v2 Public Store release 흐름에 맞게 갱신한다.
- `docs/adr/0010-defer-chrome-web-store-to-v2.md`를 새 결정으로 대체하거나 후속 ADR을 추가해 Store 배포를 진행한다는 결정을 기록한다.
- `docs/UI_GUIDE.md`의 About 문구 기준을 local unpacked v1에서 Store 배포 버전으로 바꾼다.
- Options About UI의 `local unpacked Chrome extension` 문구를 Store 배포에 맞는 문구로 바꾼다.
- `docs/MANUAL_VALIDATION.md`에 Store 제출 전 검증 절차를 추가한다.

### 2. Manifest와 패키징 준비
- 완료: `manifest.json`에 `icons`를 추가한다.
- 완료: `manifest.json`의 `action.default_icon`을 추가한다.
- 완료: icon 파일은 extension ZIP 안에 포함되는 repo 경로에 둔다.
- `package.json`에 `package:chrome` script를 추가해 `npm run build` 후 `dist`만 ZIP으로 묶는다.
- ZIP 검증 script 또는 release checklist에서 다음을 확인한다.
  - ZIP 루트에 `manifest.json`이 있다.
  - `src/`, `docs/`, `node_modules/`, `coverage/`, `.git/`, local secrets가 들어가지 않는다.
  - ZIP 용량이 Chrome Web Store 제한 안에 있다.
  - content script bundle에 static ESM `import`가 없다.

### 3. 스토어 자산 초안 제작
- 완료: 128x128 extension icon을 만든다.
- 완료: Chrome Web Store listing용 store icon을 준비한다.
- 최소 1장, 권장 3-5장의 1280x800 screenshot을 준비한다.
  - Options GitHub Connection 화면.
  - Popup Sync History 화면.
  - Problem page toast Synced 상태.
  - Failure/Retry 상태가 있으면 추가.
- 440x280 small promo tile을 만든다.
- 1400x560 marquee promo tile과 YouTube promo video는 선택 사항으로 남긴다.

### 4. Store Listing 초안 작성
- 짧은 설명과 자세한 설명을 작성한다.
- 첫 문장에 single purpose를 명확히 쓴다.
- 기능 설명은 실제 구현 범위만 포함한다.
  - LeetCode와 Programmers Accepted 제출 감지.
  - Swift/Python3만 지원.
  - 사용자가 선택한 GitHub Sync Repository/Sync Branch로 commit.
  - Solution README와 Solution Catalog 갱신.
  - Retry Bundle과 Sync History 제공.
- 제외 사항은 과장 없이 명시한다.
  - GitHub OAuth 없음.
  - 별도 backend 없음.
  - LeetCode/Programmers 문제 설명 전문 저장 없음.
  - Swift/Python3 외 언어는 commit하지 않음.
- Category, language, mature content 여부, homepage URL, support URL 후보를 정리한다.

### 5. Privacy Policy 초안 작성
- Notion에 붙여 넣을 Privacy Policy 원문을 작성한다.
- 최소 포함 항목:
  - 수집/처리하는 데이터: GitHub PAT, Sync Repository/Sync Branch 설정, Accepted solution code, problem metadata, page URL, Sync History, Retry Bundle.
  - 사용 목적: Accepted solution을 사용자가 선택한 GitHub repository에 sync하기 위함.
  - 저장 위치: Chrome extension local storage.
  - 전송 대상: GitHub API, LeetCode GraphQL, Programmers page에서 읽은 현재 editor snapshot.
  - 전송 방식: HTTPS endpoint만 사용.
  - 보관 기간: Retry Bundle 최대 20개, 최대 7일, retry 성공 후 삭제.
  - 삭제 방법: extension settings 삭제, Chrome extension storage 삭제, extension 제거.
  - 공유/판매/광고 사용 없음.
  - developer가 사용자 solution code나 PAT를 별도 backend로 받지 않음.
  - Chrome Web Store User Data Policy와 Limited Use 요구사항 준수 문구.

### 6. Privacy 탭 답변표 작성
- Single purpose 문장을 준비한다.
- Permission justification을 준비한다.
  - `storage`: PAT, settings, Sync History, Retry Bundle, deduplication state 저장.
  - `https://leetcode.com/*`: 로그인된 LeetCode 세션으로 Accepted Submission metadata/code 조회.
  - `https://school.programmers.co.kr/*`: Programmers lesson page에서 Accepted modal과 editor snapshot 감지.
  - `https://api.github.com/*`: 사용자가 선택한 Sync Repository/Sync Branch에 solution commit 생성.
- User data category 답변을 준비한다.
  - Authentication information: GitHub PAT.
  - User-generated content: solution code.
  - Website content/resources: problem metadata, page URL, editor snapshot.
  - Web browsing activity: LeetCode/Programmers problem URL interaction needed for sync.
- Remote code 사용 안 함을 명시한다.
- 광고 목적 사용, 판매, 제3자 전송 없음으로 정리한다.

### 7. Reviewer Test Instructions 작성
- reviewer가 기능을 이해할 수 있게 테스트 흐름을 작성한다.
- reviewer가 자체 GitHub PAT와 LeetCode/Programmers 계정을 사용할 수 있음을 안내한다.
- 별도 reviewer용 테스트 repository/PAT를 만들지 않는 경우, 그 이유와 필요한 권한을 명확히 쓴다.
- 포함할 테스트 흐름:
  - Options에서 PAT 입력.
  - repository/branch 선택.
  - connection test.
  - LeetCode 또는 Programmers Accepted 제출 후 GitHub commit 확인.
  - Auto Sync off와 unsupported language 동작 확인.
  - 실패 시 Popup에서 failure detail과 retry 확인.

### 8. 검증 자동화와 최종 점검
- `npm run typecheck`를 통과시킨다.
- `npm test`를 통과시킨다.
- `npm run build`를 통과시킨다.
- `npm run package:chrome`를 통과시킨다.
- 제출 ZIP 파일 목록을 확인한다.
- remote code와 obfuscation 위험 패턴을 검색한다.
  - `eval(`
  - `new Function`
  - `importScripts`
  - 원격 `<script src>`
  - `http://`
- Store 제출 전 `git status --short`로 의도하지 않은 변경이 없는지 확인한다.

## 사용자가 할 일
### 1. Chrome Web Store Developer 계정 준비
- Chrome Web Store Developer 계정을 등록한다.
- Google 계정 2-Step Verification을 켠다.
- publisher name을 정한다.
- contact email을 인증한다.
- Public 배포에 사용할 Google account 또는 group publisher를 확정한다.
- Trader/Non-Trader 상태를 확인하고 dashboard에 선언한다.

### 2. Notion Privacy Policy 공개
- Codex가 작성한 Privacy Policy 초안을 Notion 페이지에 붙여 넣는다.
- Notion 페이지를 로그인 없이 접근 가능한 공개 페이지로 설정한다.
- 공개 URL이 외부 브라우저/시크릿 창에서 열리는지 확인한다.
- Chrome Web Store Privacy Policy URL로 사용할 URL을 Codex에게 전달한다.
- Notion URL이 바뀌지 않게 유지한다.

### 3. 스토어 자산 최종 승인
- Codex가 만든 icon, screenshot, promo tile을 확인한다.
- 제품명 `SolveSync` 사용을 확정한다.
- 스토어에 노출될 짧은 설명과 자세한 설명을 승인한다.
- homepage URL과 support URL을 정한다.
- mature content가 없음을 확인한다.
- listing language와 region을 확정한다.
  - 기본값: English 또는 Korean 중 하나를 primary listing으로 사용.
  - 기본 region: all regions.

### 4. GitHub PAT와 테스트 저장소 준비
- fine-grained GitHub PAT를 준비한다.
- PAT에는 검증 대상 Sync Repository만 선택한다.
- Contents read/write 권한을 부여한다.
- Metadata read 권한이 활성화되어 있는지 확인한다.
- 실제 풀이 repository를 오염시키지 않도록 Store 검증용 branch를 준비한다.
- 필요한 경우 Store reviewer instructions에 쓸 테스트 repository를 만든다.

### 5. 실계정 수동 검증 수행
- Chrome에서 build된 `dist`를 load unpacked로 로드한다.
- LeetCode 로그인 상태를 확인한다.
- Programmers 로그인 상태를 확인한다.
- Options에서 PAT, Sync Repository, Sync Branch를 저장한다.
- connection test 성공을 확인한다.
- LeetCode Swift 또는 Python3 Accepted sync를 확인한다.
- Programmers Swift 또는 Python3 Accepted sync를 확인한다.
- Auto Sync off 상태에서 commit이 만들어지지 않는지 확인한다.
- unsupported language 상태에서 commit이 만들어지지 않는지 확인한다.
- retry 가능한 실패를 만들고 Retry 동작을 확인한다.
- 확인 결과와 발견한 문제를 Codex에게 전달한다.

### 6. Chrome Web Store Dashboard 제출
- Codex가 만든 ZIP을 Developer Dashboard에 업로드한다.
- Store Listing 탭을 입력한다.
- Privacy 탭을 입력한다.
- Distribution 탭에서 Public, all regions, 결제 없음 설정을 확인한다.
- Test instructions를 입력한다.
- 제출 전 deferred publishing 여부를 결정한다.
  - 권장: 첫 Public 제출은 review 통과 후 수동 publish 가능하도록 deferred publishing을 사용한다.
- reviewer rejection 또는 warning이 오면 원문을 Codex에게 전달한다.

## 제출 전 완료 기준
- `manifest.json`이 Store 배포용 metadata와 icons를 포함한다.
- Store 제출 ZIP이 `dist` 산출물만 포함한다.
- Store listing 문구가 실제 구현 범위와 일치한다.
- Privacy Policy URL이 공개 접근 가능하다.
- Privacy 탭 답변이 Privacy Policy 및 실제 코드 동작과 일치한다.
- 권한 justification이 manifest 권한과 일치한다.
- 사용자가 수동 검증 체크리스트를 완료했다.
- remote code, obfuscation, broad host permission 위험이 없다.
- Chrome Web Store Dashboard의 Package, Store Listing, Privacy, Distribution, Test instructions 탭이 모두 제출 가능한 상태다.

## 공식 Chrome 문서 참고
- Publish in the Chrome Web Store: https://developer.chrome.com/docs/webstore/publish
- Prepare your extension: https://developer.chrome.com/docs/webstore/prepare/
- Complete your listing information: https://developer.chrome.com/docs/webstore/cws-dashboard-listing
- Supplying Images: https://developer.chrome.com/docs/webstore/images
- Fill out the privacy fields: https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
- User Data FAQ and Limited Use: https://developer.chrome.com/docs/webstore/program-policies/user-data-faq/
- Program Policies: https://developer.chrome.com/docs/webstore/program-policies/policies
- Distribution: https://developer.chrome.com/docs/webstore/cws-dashboard-distribution
- Test instructions: https://developer.chrome.com/docs/webstore/cws-dashboard-test-instructions
- Review process: https://developer.chrome.com/docs/webstore/review-process
