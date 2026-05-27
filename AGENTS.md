# PS-LP-Sync 작업 지침

PS-LP-Sync는 LeetCode와 Programmers에서 Accepted 된 풀이를 GitHub 문제 풀이 저장소로 자동 커밋하는 Chrome 확장 프로젝트다.

## 제품 범위
- v1은 개인 사용용 local unpacked Chrome extension이다.
- v1은 LeetCode와 Programmers의 Swift, Python3 제출만 지원한다.
- v1은 Accepted 된 풀이를 사용자가 선택한 GitHub 저장소와 branch로 동기화한다. 특정 저장소를 코드 기본값으로 고정하지 않는다.
- Chrome Web Store 배포, GitHub OAuth, Swift/Python3 외 언어 지원은 v1 범위가 아니다.

## 기술 스택
- Chrome Extension Manifest V3.
- TypeScript strict mode.
- Vite 기반 확장 번들링.
- npm 패키지 관리.
- Vitest 단위 테스트.
- Options, Popup, Toast UI는 Vanilla HTML/CSS/TypeScript로 작성한다.

## 아키텍처 규칙
- 이 저장소는 standalone extension 제품이므로 소스 코드는 루트의 `src/` 아래에 둔다.
- 런타임 모듈은 다음 책임으로 분리한다.
  - `src/content`: LeetCode/Programmers 페이지 관찰, Accepted 감지, Programmers editor snapshot 추출, toast 렌더링, background 메시징.
  - `src/background`: sync orchestration, platform source resolver, LeetCode/GitHub API client, storage, retry, history.
  - `src/options`: PAT, repository picker, branch picker, branch 생성, Auto Sync, 연결 테스트.
  - `src/popup`: Auto Sync 토글, 최근 sync 기록, 실패 상세, retry 제어.
  - `src/shared`: 타입, platform policy, runtime message union, 언어 매핑, 경로 생성, README/index 생성, storage schema, error normalization.
- content script는 GitHub API를 직접 호출하지 않는다. 외부 write 작업은 background service worker를 통해서만 수행한다.
- LeetCode API와 GitHub API 실행 코드는 `src/background/client` 아래에 격리한다. API 변경 영향이 UI 코드로 퍼지면 안 된다.
- Programmers는 공식 제출 상세 API가 확인되기 전까지 content script의 현재 문제 페이지 DOM/editor snapshot을 source로 사용한다. Programmers DOM/editor 변경 영향은 content platform adapter와 snapshot extractor 밖으로 퍼지면 안 된다.
- Manifest V3 service worker는 오래 유지되는 in-memory state를 source of truth로 쓰면 안 된다. 진행 상태, retry, processed 제출, history는 `chrome.storage.local` 기준으로 복구 가능해야 한다.
- Manifest `content_scripts`로 로드되는 content bundle은 classic script로 실행되므로 ESM `import`가 남으면 안 된다. content entry는 별도 IIFE bundle로 빌드하고 build 검증을 통과해야 한다.
- path 생성, README 생성, index merge, error normalization은 순수 함수로 분리하고 Vitest 테스트를 작성한다.
- 빌드 산출물과 설치 의존성은 커밋하지 않는다. `dist/`, `node_modules/`, coverage output은 gitignore 대상이다.

## 동기화 규칙
- LeetCode 페이지에서는 DOM 관찰로 `Accepted`를 감지한다.
- Programmers 페이지에서는 DOM 관찰로 `정답입니다!` 모달을 Accepted 1차 신호로 감지한다. `통과` 단독 문구는 Accepted 신호로 사용하지 않는다.
- content detector는 플랫폼 DOM class selector나 페이지 전체 텍스트 scan에 의존하지 않는다. `MutationObserver`가 전달한 변경 범위 안에서 제한된 leaf text 후보를 검사해 Accepted 이벤트만 감지한다.
- 실제 제출 코드와 문제 메타데이터는 현재 브라우저 로그인 세션으로 LeetCode GraphQL API를 우선 호출해 가져온다.
- Programmers 제출 코드는 Accepted 직후 현재 editor snapshot에서 가져온다. editor code를 안정적으로 추출하지 못하면 GitHub commit을 만들지 않고 extract 실패로 기록한다.
- 실패, pending, runtime error, wrong answer, 미지원 언어 제출은 동기화하지 않는다.
- 처리된 제출의 안정적인 식별자는 `platform`, `submissionId`, `titleSlug`, language 조합이다.
- Programmers는 실제 제출 ID가 없는 경우 `programmers:{lessonId}:{language}:{codeHash}` 형식의 deterministic submission id를 사용한다.
- 같은 identity는 storage 기반 in-flight lock으로 동시에 하나만 처리한다. in-flight lock은 10분 TTL을 두고 stale lock은 새 sync 시작 전에 정리한다.
- `processedSubmissions`에는 GitHub commit 성공 후에만 기록한다.
- 같은 문제/언어의 새 Accepted 제출은 같은 solution path를 최신 풀이로 덮어쓴다.
- 대상 저장소의 풀이 구조는 `leetcode`, `programmers` 같은 플랫폼 폴더를 먼저 두고 그 내부를 언어별로 나눈다.
- Swift LeetCode 풀이는 대상 저장소의 `leetcode/swift/0001_two_sum.swift` 형식 경로에 저장한다.
- Python3 LeetCode 풀이는 대상 저장소의 `leetcode/python/0001_two_sum.py` 형식 경로에 저장한다.
- Swift Programmers 풀이는 대상 저장소의 `programmers/swift/120804_두_수의_곱_구하기.swift` 형식 경로에 저장한다.
- Python3 Programmers 풀이는 대상 저장소의 `programmers/python/120804_두_수의_곱_구하기.py` 형식 경로에 저장한다.
- 생성된 Swift 풀이 파일을 대상 저장소의 `swift/SwiftAlgorithm` 아래에 두지 않는다. 해당 폴더는 Xcode 빌드 소스 전용이다.
- 대상 저장소에 플랫폼 풀이 폴더, 플랫폼 README, 플랫폼 index가 없어도 첫 GitHub commit에서 생성해야 한다.
- GitHub에는 폴더 생성 API를 따로 쓰지 않는다. 원하는 경로에 파일을 커밋해 중간 폴더가 생기게 한다.
- 대상 GitHub 저장소는 Options에서 PAT로 접근 가능한 본인 owner repository 목록 중 사용자가 선택한다.
- branch는 선택된 repository의 branch 목록 중 사용자가 선택한다. 존재하지 않는 branch는 사용자가 명시적으로 생성 action을 실행한 경우에만 repository default branch HEAD에서 생성한다.
- 확장은 branch를 자동 생성하지 않는다. 오타 branch 생성을 피하고 write 동작을 사용자 의사와 분리하기 위해서다.

## README와 Index 규칙
- 대상 저장소의 `leetcode/.leetcode-sync/index.json`과 `programmers/.programmers-sync/index.json`이 각 플랫폼 동기화 메타데이터의 source of truth다.
- v1은 README를 항상 갱신한다. README 갱신 토글이나 README 비갱신 모드는 만들지 않는다.
- `leetcode/README.md`와 `programmers/README.md`는 각 플랫폼 index를 기준으로 생성한다.
- README의 managed marker 밖 내용은 보존한다.
- LeetCode managed marker는 반드시 아래 문자열을 그대로 사용한다.
  - `<!-- LEETCODE_TABLE_START -->`
  - `<!-- LEETCODE_TABLE_END -->`
- Programmers managed marker는 반드시 아래 문자열을 그대로 사용한다.
  - `<!-- PROGRAMMERS_TABLE_START -->`
  - `<!-- PROGRAMMERS_TABLE_END -->`
- README가 있지만 marker가 없으면 파일 하단에 marker block을 추가한다.
- README가 없으면 marker block을 포함한 최소 README를 생성한다.

## 보안 규칙
- CRITICAL: GitHub PAT, LeetCode/Programmers cookie, session token, 실제 사용자 secret을 source, test fixture, 문서 예시에 하드코딩하지 않는다.
- CRITICAL: LeetCode/Programmers 문제 설명 전문을 저장하지 않는다. 저장 대상은 풀이 코드, 문제 메타데이터, README 진행표, sync 상태뿐이다.
- v1에서 PAT는 `chrome.storage.local`에 저장한다. Options UI와 문서는 이 한계를 명확히 알려야 한다.
- retry payload에는 실패한 제출 코드가 브라우저 local storage에 임시 저장될 수 있다. UI와 문서에 이 사실을 명시한다.
- retry payload는 최대 20개, 최대 7일 보관하고 retry 성공 후 삭제한다.
- GitHub 권한은 v1에 필요한 최소 범위만 요구한다. selected repository 접근, Metadata read, Contents read/write 권한만 사용한다.

## 개발 프로세스
- 변경은 작고 테스트 가능하게 나눈다.
- shared logic을 추가하거나 변경할 때는 Vitest 테스트를 함께 작성한다.
- UI 코드는 얇게 유지한다. 업무 규칙은 shared 모듈 또는 background orchestration에 둔다.
- 외부 API error는 사용자에게 보여주기 전에 normalize 한다.
- 커밋 메시지는 `feat:`, `fix:`, `docs:`, `test:`, `refactor:` 같은 conventional commits 형식을 따른다.
- 사용자가 명시적으로 요청하지 않는 한 README는 수정하지 않는다.

## 명령어
확장 프로젝트 파일이 생성된 뒤 저장소 루트에서 실행한다.

```bash
npm install
npm run typecheck
npm test
npm run build
```

Chrome 확장 수동 검증은 빌드 후 `chrome://extensions`에서 Developer mode를 켜고 `dist` 디렉터리를 unpacked로 로드한다.

```bash
npm run build
```
