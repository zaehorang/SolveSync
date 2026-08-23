# Chrome Web Store 배포

> **Description**: SolveSync를 Chrome Web Store에 Public으로 제출하고 출시하기 위한 계획, 제출 항목과 Release Gate를 정의한다.

- 공식 Chrome Web Store 문서 확인일: 2026-08-12
- 목표 채널: Chrome Web Store Public
- 현재 기준 버전: `0.1.0`

배포를 진행한다는 결정은 [ADR 0038](adr/0038-chrome-web-store-public-release.md)이다. 각 단계는 `CLAUDE.md`의 Git Workflow를 따라 work branch와 PR로 진행한다.

**진행 상황은 이 문서에 적지 않는다.** 무엇을 언제 했는지는 PR과 commit history에 남고, 여기에 적으면 낡는다. 이 문서에는 무엇을 만족해야 제출할 수 있는지만 둔다.

## 1. 목표

SolveSync를 local unpacked public preview에서 Chrome Web Store를 통해 설치하고 업데이트할 수 있는 Public extension으로 전환한다.

첫 배포는 다음 조건을 만족해야 한다.

- Store Listing과 실제 제품 동작이 일치한다.
- Privacy Policy, Privacy 탭 답변, UI disclosure가 같은 데이터 처리 방식을 설명한다.
- GitHub App과 지원 Coding Platform 접근 권한이 single purpose에 필요한 최소 범위다.
- 실제 계정으로 핵심 Accepted-to-GitHub 흐름을 검증한다.
- 검증된 `dist` 내용만 포함한 ZIP을 제출한다.
- 심사 통과 후 최종 확인을 거쳐 사용자가 명시적으로 Public publish한다.

## 2. 범위

### 포함

- Public Chrome Web Store item 생성과 첫 제출 준비
- 제품 문서와 UI copy의 Store release 전환
- Store Listing, Privacy Policy, Privacy 탭 답변, reviewer test instructions 작성
- Store icon, screenshots, small promo tile 준비
- manifest, permission, remote code, secret 포함 여부 검토
- 자동 검증과 실제 계정 수동 검증
- release candidate ZIP 생성
- 심사 반려 또는 warning 대응
- 승인 후 deferred publishing을 통한 수동 출시

### 제외

- 지원 Coding Platform 추가
- 새로운 solution language 추가
- cloud backend 도입
- 일반 수동 sync 기능 추가
- organization/team repository 지원
- Chrome Web Store Publish API 기반 자동 배포
- Chrome Web Store 출시와 무관한 UI 또는 architecture 재설계

Store 심사 준비 중 기능 결함이 발견되면 배포 차단 여부를 판단해 최소 수정만 포함한다. 제품 범위 변경이 필요한 경우 `docs/PRD.md`와 관련 ADR을 먼저 갱신한다.

## 3. 제출 준비 항목

각 항목은 만족 여부를 확인할 수 있는 상태로 적는다. 진행 서술은 두지 않는다.

### 제품과 빌드

- [x] Manifest V3 구조, `storage`와 최소 host permission 선언
- [x] 16/32/48/128px icon과 build 결과 복사
- [x] classic content script bundle과 static ESM import 검증
- [x] `npm run package:chrome`의 ZIP 생성, root/필수/금지 경로 검사
- [x] 공개 GitHub App Device Flow와 expiring user access token
- [x] client secret과 private key를 쓰지 않는 build 구조
- [x] PR마다 typecheck/test/build를 실행하는 CI
- [ ] Options About/Security의 local unpacked 전용 copy를 Store 배포 문구로 전환
- [ ] 정식 GitHub App 이름과 slug를 build 설정과 Store copy에 반영

### 제출 문서

- [ ] Store Listing 짧은 설명과 자세한 설명
- [ ] category, language, maturity, homepage URL, support URL
- [ ] 로그인 없이 열리는 공개 Privacy Policy URL
- [ ] Privacy 탭의 single purpose, permission justification, user data category 답변
- [ ] reviewer test instructions

### Store 자산

- [ ] 1280x800 screenshots
- [ ] 440x280 small promo tile

### 외부 계정

- [ ] Chrome Web Store Developer 계정, 등록비, 2-Step Verification
- [ ] publisher name과 contact email
- [ ] Trader/Non-Trader 선언

### 검증

- [ ] Store release를 반영한 PRD, ADR, UI Guide, Manual Validation
- [ ] release candidate의 실계정 수동 검증

## 4. 역할과 책임

### Agent 책임

- 목적별 work branch에서만 문서와 코드를 변경한다.
- 관련 source of truth와 구현이 일치하도록 PRD, ADR, Architecture, UI Guide, Manual Validation의 갱신 필요성을 판단한다.
- Options, Popup, Toast의 Store release copy를 구현하고 i18n 테스트를 갱신한다.
- Store Listing의 short description, detailed description과 metadata 초안을 작성한다.
- Notion에 게시할 Privacy Policy 원문을 작성한다.
- Privacy 탭의 single purpose, permission justification, user data category, Limited Use 답변표를 작성한다.
- reviewer test instructions를 작성한다.
- 사용자가 제공한 안전한 test 화면을 Store 규격 screenshot으로 정리한다.
- small promo tile을 제작한다.
- manifest, host permission, remote code, data flow와 disclosure의 일치 여부를 검토한다.
- typecheck, test, build, package 검증을 실행한다.
- secret과 금지 경로가 없는 최종 ZIP을 생성하고 파일 목록을 검토한다.
- 사용자가 전달한 심사 반려 사유를 분석하고 필요한 최소 수정안을 구현한다.
- 사용자가 승인하면 commit, push, Pull Request 생성까지 수행한다.

Agent는 Google, GitHub와 Coding Platform 사용자 계정의 인증 정보나 법적 선언을 대신 입력하지 않는다.

### 사용자 책임

- 배포에 사용할 Google 계정 또는 publisher group을 결정한다.
- Chrome Web Store Developer 등록, 등록비 결제, 2-Step Verification을 완료한다.
- publisher name, contact email, Trader/Non-Trader 상태를 직접 선언한다.
- listing primary language, distribution region, homepage URL, support URL을 확정한다.
- Public GitHub App의 Device Flow, expiring token, installation scope와 repository permission을 확인한다.
- 정식 GitHub App 이름과 public slug를 확정한다.
- Agent가 작성한 Privacy Policy를 검토하고 로그인 없이 접근 가능한 Notion 페이지로 공개한다.
- Privacy Policy URL을 Agent에게 전달한다.
- 실제 GitHub와 지원 Coding Platform 계정으로 수동 검증을 수행한다.
- screenshot용 화면을 민감정보 없이 준비하거나 Agent의 화면 제작 절차에 협조한다.
- Chrome Web Store Dashboard의 법적·정책 확인란을 직접 검토하고 제출한다.
- reviewer response 원문을 민감정보 없이 Agent에게 전달한다.
- 승인된 item의 최종 Public publish를 결정하고 실행한다.

### 공유 책임

- Store Listing, Privacy Policy와 UI disclosure의 최종 문구를 함께 승인한다.
- screenshot에 token, device code, cookie, private solution code, private repository 정보가 없는지 함께 확인한다.
- release candidate 수동 검증 결과를 기록하고 배포 차단 결함을 함께 판단한다.
- manifest permission 변경이나 개인정보 처리 변경은 제출 전에 다시 검토한다.

## 5. 사용자 결정이 필요한 입력

구현을 시작하기 전에 다음 값을 확정하거나 임시 기본값을 승인한다.

| 항목 | 권장 기본값 | 담당 |
| --- | --- | --- |
| Visibility | Public | 사용자 |
| Publishing | Deferred publishing | 사용자 |
| Regions | All regions | 사용자 |
| Pricing | Free | 사용자 |
| Primary listing language | English | 사용자 |
| Secondary listing language | Korean | 사용자 |
| Publisher owner | 배포 전용 Google 계정 또는 publisher group | 사용자 |
| Publisher name | `SolveSync`와 일관된 이름 | 사용자 |
| Homepage URL | Public GitHub repository 또는 공식 landing page | 사용자 |
| Support URL | GitHub Issues 또는 별도 support page | 사용자 |
| Privacy Policy URL | Public Notion page | 사용자 |
| GitHub App name | `SolveSync` | 사용자 |
| GitHub App slug | 정식 App에서 생성된 public slug | 사용자 |
| Initial Store version | `0.1.0` | 공유 |

GitHub App client ID와 slug는 공개 build 설정이다. client secret, private key, access token, refresh token, device code, cookie, session token은 공유하거나 문서·issue·fixture에 기록하지 않는다.

## 6. 실행 단계

### Phase 0. 외부 계정과 배포 결정

담당: 사용자

작업:

1. Chrome Web Store Developer 계정을 등록하고 일회성 등록비를 결제한다.
2. 2-Step Verification과 contact email 인증을 완료한다.
3. publisher name과 Trader/Non-Trader 상태를 선언한다.
4. Public, All regions, Free, deferred publishing 사용을 확정한다.
5. homepage와 support URL을 정한다.
6. 정식 GitHub App 이름, slug와 permission을 확인한다.

완료 조건:

- Developer Dashboard에서 새 item을 만들 수 있다.
- 이 문서의 사용자 결정 표가 모두 채워져 있다.
- 최종 build에 사용할 public GitHub App client ID와 slug가 준비되어 있다.

### Phase 1. 제품 계약과 UI copy 전환

담당: Agent, 사용자 승인

작업:

1. `docs/PRD.md`의 unpacked preview와 v2 Store release 서술을 현재 배포 목표에 맞게 갱신한다.
2. [ADR 0038](adr/0038-chrome-web-store-public-release.md)이 Store 배포 결정을 갖는다. 진행 중 결정이 또 바뀌면 새 번호로 쓰고 0038을 supersede한다.
3. `docs/UI_GUIDE.md`의 About/Security copy 기준을 Store release에 맞게 갱신한다.
4. Options의 `local unpacked Chrome extension` 문구를 제거한다.
5. backend, local storage, Retry Bundle disclosure는 실제 동작과 일치하게 유지한다.
6. `docs/MANUAL_VALIDATION.md`에 Store 제출용 검증 절차를 추가한다.

검증:

- UI copy와 i18n test
- 관련 문서 사이의 release scope 비교
- README는 사용자의 별도 요청 없이 수정하지 않음

완료 조건:

- UI와 source of truth 어디에도 현재 배포 목표와 충돌하는 `Store 배포 제외` 또는 `local unpacked 전용` 계약이 남아 있지 않다.

### Phase 2. Store와 Privacy 제출 문서 작성

담당: Agent 작성, 사용자 승인·게시

산출물:

- Store short description
- Store detailed description
- category, language, maturity, homepage, support metadata 표
- Privacy Policy 영어/한국어 초안
- Privacy 탭 답변표
- reviewer test instructions

Privacy 답변은 최소 다음을 설명한다.

- `storage`: auth session, settings, Sync History, Retry Bundle, deduplication state
- `https://leetcode.com/*`: 로그인된 사용자의 Accepted submission metadata와 solution source 조회
- `https://school.programmers.co.kr/*`: Accepted transition과 Accepted Editor Snapshot 감지
- `https://swexpertacademy.com/*`: Accepted layer 감지와 MAIN world bridge를 통한 Accepted Editor Snapshot 수집
- `https://github.com/*`: GitHub App Device Flow token endpoint
- `https://api.github.com/*`: 선택한 Sync Repository와 Sync Branch 조회 및 commit 생성
- remote code 미사용
- 별도 backend, 광고, 판매, 프로파일링 미사용
- solution code, auth information, website content와 page URL의 사용 목적
- Retry Bundle의 cap, TTL과 삭제 방법
- Chrome Web Store User Data Policy Limited Use 준수

Store Listing 문구는 실제 구현 범위만 담는다. 과장이 아니라 **불일치**가 반려 사유다.

- 포함: 지원 Coding Platform의 Accepted 감지, 지원 언어, 사용자가 선택한 Sync Repository/Sync Branch commit, Solution README/Catalog 갱신, Retry Bundle과 Sync History
- 제외로 명시: 별도 backend 없음, 문제 설명 전문 저장 없음, 지원 목록 밖 언어는 commit하지 않음, SWEA는 C++14/JAVA/Python 3만

Privacy Policy 원문에 최소한 담을 것.

- 수집·처리 데이터, 사용 목적, 저장 위치(Chrome extension local storage), 전송 대상과 HTTPS 사용
- Retry Bundle의 cap과 TTL, retry 성공 후 삭제
- 삭제 방법: extension settings 삭제, Chrome extension storage 삭제, extension 제거
- 공유·판매·광고 사용 없음, developer가 solution code나 token을 별도 backend로 받지 않음
- Chrome Web Store User Data Policy와 Limited Use 준수 문구

User data category 답변.

- Authentication information: GitHub App access/refresh token과 Device Flow state
- User-generated content: solution code
- Website content/resources: problem metadata, page URL, Accepted Editor Snapshot
- Web browsing activity: sync에 필요한 문제 page URL 상호작용

reviewer test instructions에 포함할 흐름. reviewer가 자기 GitHub 계정으로 Device Flow 로그인과 App 설치를 할 수 있다는 것을 먼저 밝힌다.

1. Options에서 GitHub 로그인과 App 설치
2. Sync Repository와 Sync Branch 선택, connection test
3. 같은 문제를 지원 언어 두 개로 Accepted 제출한 뒤 두 solution file과 단일 README row 확인
4. GitHub 연결 해제 후 재연결. repository/branch 설정이 유지되는지 확인
5. 다른 Coding Platform에서 Accepted 제출 후 GitHub commit 확인

완료 조건:

- Privacy Policy가 시크릿 창에서 로그인 없이 열린다.
- Store Listing, Privacy Policy, Privacy 탭 답변, Options Security disclosure가 같은 데이터 흐름을 설명한다.
- reviewer가 별도 내부 지식 없이 핵심 흐름을 재현할 수 있다.

### Phase 3. Store graphic assets

담당: Agent 제작, 사용자 실계정 화면 제공·승인

필수 산출물:

- 128x128 Store icon: 기존 `icons/icon-128.png` 검토 후 사용
- 1280x800 screenshot 최소 1장, 목표 4장
- 440x280 small promo tile 1장

권장 screenshot:

1. Options GitHub Connection과 repository/branch 설정
2. Popup Sync History
3. Coding Platform 문제 페이지의 Synced toast
4. 실패 상세와 Retry 상태

안전 규칙:

- test repository와 공개 가능한 sample solution만 사용한다.
- token, device code, cookie, email, private repository, private solution code를 제거한다.
- 실제 기능보다 과장된 UI나 지원 범위를 이미지에 표시하지 않는다.
- promo tile은 screenshot 복사보다 SolveSync의 single purpose와 브랜드를 전달한다.

완료 조건:

- 모든 이미지가 Store 규격과 안전 규칙을 만족한다.
- 사용자가 최종 자산을 승인한다.

### Phase 4. Release candidate와 자동 검증

담당: Agent

작업:

1. manifest name, version, description, icons, permissions를 검토한다.
2. 정식 public GitHub App client ID와 slug로 production build한다.
3. 자동 검증을 실행한다.

```bash
npm run typecheck
npm test
npm run build
npm run package:chrome -- v0.1.0
```

4. ZIP 파일 목록과 크기를 확인한다.
5. remote code와 obfuscation 위험 패턴을 검사한다.
6. client secret, private key, token, cookie, `.env`가 ZIP과 tracked files에 없는지 확인한다.
7. content script에 static ESM import가 없는지 확인한다.

완료 조건:

- 모든 자동 검증이 통과한다.
- ZIP root에 `manifest.json`이 있다.
- `src`, `docs`, `node_modules`, `coverage`, `.git`, `.env`, `artifacts`가 ZIP에 없다.
- ZIP에는 Store 제출에 필요한 `dist` 내용만 포함된다.
- ZIP 크기가 Chrome Web Store의 2GB 제한 미만이다.
- Git working tree에 의도하지 않은 변경이 없다.

제출 ZIP에서 remote code와 obfuscation 위험 패턴을 검색한다. 하나라도 걸리면 제출하지 않고 원인을 확인한다.

```text
eval(
new Function
importScripts
원격 <script src>
http://
```

### Phase 5. 실제 계정 수동 검증

담당: 사용자 실행, Agent 문제 분석·수정

검증 환경:

- 정식 release candidate build
- 사용자가 소유한 별도 test repository
- 실제 풀이 branch와 분리된 test Sync Branch
- 로그인된 GitHub 계정과 지원 Coding Platform 계정 전부(LeetCode, Programmers, SWEA)

필수 시나리오:

1. GitHub Device Flow 로그인과 App 설치
2. Sync Repository와 Sync Branch 선택
3. commit 없는 connection test
4. LeetCode 지원 언어 Accepted sync
5. Programmers 같은 문제의 서로 다른 두 언어 Accepted sync
6. 두 solution file과 단일 README row/Catalog 확인
7. SWEA Accepted sync. MAIN world bridge가 화면 밖으로 스크롤된 줄까지 포함한 code를 돌려주는지 확인한다. 이 경로가 깨져도 다른 플랫폼은 멀쩡하므로 따로 보지 않으면 드러나지 않는다
8. GitHub 연결 해제·재연결 후 repository/branch 설정 보존
9. retry 가능한 실패와 Retry Bundle 동작 확인
10. Popup, Options, Toast에 secret이 표시되지 않는지 확인
11. Chrome extension error와 content script import error가 없는지 확인

완료 조건:

- `docs/MANUAL_VALIDATION.md`의 release smoke가 통과한다.
- 배포 차단 결함이 없다.
- 발견한 비차단 residual risk는 관련 source of truth 또는 investigation note에 정확한 상태로 기록한다.

### Phase 6. Dashboard 제출

담당: 사용자, Agent 입력자료 제공

작업:

1. 새 Chrome Web Store item을 만든다.
2. 최종 release candidate ZIP을 업로드한다.
3. Store Listing을 입력한다.
4. Privacy 탭과 Privacy Policy URL을 입력한다.
5. Distribution을 Public, All regions, Free로 설정한다.
6. reviewer test instructions를 입력한다.
7. 제출 전 Package, Store Listing, Privacy, Distribution, Test instructions를 함께 대조한다.
8. deferred publishing을 선택하고 Submit for Review한다.

완료 조건:

- item 상태가 Pending review다.
- 제출한 ZIP version과 release 기록이 일치한다.
- Dashboard 입력값 사본에서 secret을 제외하고 보존한다.
- 승인 후 staged submission의 만료일을 기록한다.

### Phase 7. 심사 대응과 Public 출시

담당: 공유

작업:

1. 사용자는 reviewer response 원문을 Agent에게 전달한다.
2. Agent는 정책, listing, privacy, permission, 기능 결함으로 원인을 분류한다.
3. 코드나 manifest 수정이 필요하면 version을 올리고 전체 release gate를 다시 수행한다.
4. 문구나 Dashboard metadata만 수정해도 코드 동작과 불일치가 없는지 다시 확인한다.
5. 승인 후 Store 설치본으로 GitHub 연결과 대표 Accepted sync를 smoke test한다.
6. 승인 후 30일 안에 사용자가 staged item을 Public publish한다. 기한이 지나 draft로
   돌아가면 다시 review를 받아야 한다.

완료 조건:

- Chrome Web Store Public listing에서 SolveSync를 설치할 수 있다.
- Store 설치본의 핵심 sync 흐름이 정상 동작한다.
- Privacy Policy와 support URL이 공개 접근 가능하다.
- 출시 version과 Git tag/release 기록이 일치한다.

## 7. 주요 위험과 대응

| 위험 | 영향 | 대응 |
| --- | --- | --- |
| broad host permission으로 보이는 권한 | 심사 지연 또는 반려 | 각 host가 필요한 정확한 endpoint와 사용자 기능을 justification에 설명하고 불필요한 권한을 제거한다. |
| GitHub token의 local storage 저장 | 개인정보·보안 검토 | UI와 Privacy Policy에 저장 위치와 목적을 명시하고 코드 노출 경로와 추가 보호 필요성을 제출 전 재검토한다. |
| Programmers와 SWEA의 Accepted Editor Snapshot 의존 | reviewer 재현 차이 | residual risk를 과장 없이 설명하고 실제 페이지 수동 검증 및 관련 regression test를 유지한다. |
| GitHub App 이름/slug가 Preview로 남음 | 사용자 혼동과 reviewer 신뢰 저하 | 정식 App 이름과 slug를 확정하고 Store copy, build config, install link를 일치시킨다. |
| Store copy와 구현 불일치 | 정책 반려 | 지원 플랫폼, 언어, repository 범위, backend 부재를 실제 구현만 기준으로 작성한다. |
| screenshot의 민감정보 노출 | 개인정보 유출 | 전용 test data 사용, 촬영 전후 2회 검토, 원본 공유 범위 제한. |
| 심사 중 새 build 업로드 필요 | 일정 지연 | 첫 제출 전 release candidate를 동결하고 변경 시 manifest version과 전체 검증을 다시 수행한다. |
| 장기 review pending | 출시 일정 지연 | 자동 공개 일정을 약속하지 않고 상태를 추적하며 공식 기준을 넘으면 Developer Support에 문의한다. |
| 승인 후 30일 안에 미공개 | staged submission이 draft로 돌아가 재심사 필요 | 승인 즉시 만료일을 기록하고 Store 설치본 smoke test와 Public publish 일정을 확정한다. |

## 8. Release Gate

다음 항목이 모두 충족되어야 Submit for Review한다.

- [ ] Developer 계정, 2-Step Verification, publisher 정보가 준비됐다.
- [ ] Public/All regions/Free/deferred publishing 결정이 완료됐다.
- [ ] 정식 GitHub App 설정과 public build 값이 준비됐다.
- [ ] PRD, ADR, UI Guide, Manual Validation이 Store release를 반영한다.
- [ ] Options의 local unpacked 전용 copy가 제거됐다.
- [ ] Store Listing 문구를 사용자가 승인했다.
- [ ] Privacy Policy가 공개됐고 URL을 검증했다.
- [ ] Privacy 탭 답변과 permission justification을 승인했다.
- [ ] reviewer test instructions를 승인했다.
- [ ] 필수 icon, screenshots, promo tile이 준비됐다.
- [ ] typecheck, test, build, package가 통과했다. 앞의 셋은 CI가 PR마다 실행하므로 제출 시점의 `main`이 초록인지 확인한다. `npm run package:chrome`은 별도로 실행한다.
- [ ] ZIP 파일 목록, 크기, secret, remote code 검사가 통과했다.
- [ ] GitHub, LeetCode, Programmers 수동 release smoke가 통과했다.
- [ ] Dashboard 모든 탭을 제출 전 대조했다.

## 9. 작업 단위와 권장 순서

1. 외부 계정·publisher·GitHub App 결정
3. 제품 문서와 UI copy 전환 PR
4. Store Listing·Privacy·reviewer 문서 PR
5. Store graphic assets 준비
6. release candidate build와 자동 검증
7. 사용자 실계정 수동 검증
8. 최종 ZIP과 Dashboard 제출 패키지 승인
9. Submit for Review
10. 심사 대응 또는 승인 후 smoke test
11. Public publish

각 작업은 가능한 작은 목적별 branch와 Pull Request로 진행한다. 최종 ZIP은 모든 관련 변경이 `main`에 병합된 뒤 새 release branch 또는 tag 대상 commit에서 다시 생성한다.

## 10. 참고 문서

- 제품 범위: `docs/PRD.md`
- 런타임과 데이터 처리: `docs/ARCHITECTURE.md`
- UI와 disclosure: `docs/UI_GUIDE.md`
- 수동 검증: `docs/MANUAL_VALIDATION.md`
- Coding Platform 연동 계약: `docs/platforms/README.md`
- GitHub App 설정: `docs/GITHUB_APP_SETUP.md`
- Manifest V3 결정: `docs/adr/0002-chrome-manifest-v3.md`
- Store 배포 결정: `docs/adr/0038-chrome-web-store-public-release.md`
- 최소 host permission 결정: `docs/adr/0019-minimal-host-permissions.md`

공식 Chrome Web Store 문서.

- Developer 계정 등록: https://developer.chrome.com/docs/webstore/register/
- Prepare your extension: https://developer.chrome.com/docs/webstore/prepare/
- Store 제출과 deferred publishing: https://developer.chrome.com/docs/webstore/publish/
- Store Listing과 이미지 규격: https://developer.chrome.com/docs/webstore/cws-dashboard-listing
- Supplying Images: https://developer.chrome.com/docs/webstore/images
- Privacy 탭 작성: https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
- User Data Policy와 Limited Use: https://developer.chrome.com/docs/webstore/program-policies/user-data-faq/
- Program Policies: https://developer.chrome.com/docs/webstore/program-policies/policies
- Distribution: https://developer.chrome.com/docs/webstore/cws-dashboard-distribution
- Test instructions: https://developer.chrome.com/docs/webstore/cws-dashboard-test-instructions
- Review process: https://developer.chrome.com/docs/webstore/review-process
