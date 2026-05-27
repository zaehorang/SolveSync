# Architecture Decision Records

## 철학
PS-LP-Sync는 안정적인 개인 워크플로우를 먼저 최적화한다. 확장은 로컬에서 간단히 설치할 수 있어야 하고, 보안 tradeoff를 명확히 알려야 하며, LeetCode나 GitHub API 변경이 생겨도 영향 범위가 좁아야 한다.

---

### ADR-001: Standalone extension 저장소
**결정**: PS-LP-Sync를 standalone Chrome extension 프로젝트로 유지하고 source code는 루트의 `src/` 아래에 둔다.

**이유**: 이 확장은 특정 알고리즘 저장소 내부 도구가 아니라 독립 제품이다. 대상 저장소는 설정값으로 다뤄야 한다.

**트레이드오프**: 확장은 local file path가 아니라 원격 대상 저장소의 path 규칙을 기준으로 동작해야 한다.

---

### ADR-002: Chrome Manifest V3
**결정**: Chrome Manifest V3 기반으로 확장을 구현한다.

**이유**: Manifest V3는 현재 Chrome extension 표준이며 service worker, content script, options page, popup page, storage, host permissions를 제공한다.

**트레이드오프**: Background logic은 service worker lifecycle 제약을 고려해야 하며 오래 유지되는 in-memory state에 의존하면 안 된다.

---

### ADR-003: TypeScript, Vite, npm, Vitest
**결정**: TypeScript, Vite, npm, Vitest를 사용한다.

**이유**: TypeScript는 API payload와 상태 모델 안정성을 높인다. Vite는 여러 extension entry point를 적은 설정으로 번들링할 수 있다. npm은 사용 환경 의존성이 낮다. Vitest는 Vite와 잘 맞고 순수 로직 테스트에 충분하다.

**트레이드오프**: raw JavaScript 확장보다 Node build step과 lockfile 관리가 추가된다.

---

### ADR-004: Vanilla DOM UI
**결정**: Options, Popup, Toast UI는 Vanilla HTML/CSS/TypeScript로 작성한다.

**이유**: v1 UI는 작고 도구 성격이 강하다. UI framework를 쓰지 않으면 bundle size와 설정, runtime 복잡도를 줄일 수 있다.

**트레이드오프**: 상태 렌더링을 직접 관리해야 하며, UI가 커지면 이후 framework 도입을 검토할 수 있다.

---

### ADR-005: DOM 감지와 LeetCode API 조회 결합
**결정**: DOM 관찰로 Accepted 이벤트를 감지하고, 실제 submission 상세는 LeetCode GraphQL 우선 API client로 가져온다.

**이유**: DOM은 사용자가 보는 결과 이벤트 감지에 적합하고, API는 정확한 code, language, submission id, problem metadata를 얻는 데 적합하다.

**트레이드오프**: LeetCode internal API는 안정성이 보장되지 않으므로 client 코드를 격리하고 변경에 대응해야 한다.

---

### ADR-006: v1은 OAuth 대신 fine-grained PAT 사용
**결정**: v1에서는 사용자가 입력한 fine-grained GitHub PAT를 사용한다.

**이유**: PAT 방식은 v1을 local extension으로 빠르게 검증할 수 있게 한다. OAuth app 등록, callback 처리, 배포 준비가 필요 없다.

**트레이드오프**: `chrome.storage.local`의 PAT 저장은 OS keychain 수준의 보안이 아니다. UI와 문서에서 이 한계와 최소 권한 token 사용을 명확히 안내해야 한다.

---

### ADR-007: 단일 commit을 위해 GitHub Git Data API 사용
**결정**: GitHub Contents API 대신 Git Data API를 사용한다.

**이유**: Git Data API는 solution code, README, index를 한 commit으로 묶을 수 있다. Accepted 제출 하나와 GitHub history 하나가 대응되어 추적이 깔끔하다.

**트레이드오프**: ref, tree, blob, commit, branch update conflict를 직접 다뤄야 하므로 구현이 더 복잡하다.

---

### ADR-008: Index file을 README source of truth로 사용
**결정**: LeetCode sync metadata는 `leetcode/.leetcode-sync/index.json`에 저장하고 `leetcode/README.md`는 이 index에서 생성한다.

**이유**: README table을 상태로 파싱하는 방식은 깨지기 쉽다. 구조화된 index를 두면 README 생성이 결정적이고 복구 가능하다.

**트레이드오프**: 대상 저장소의 플랫폼 폴더 안에 추가 metadata file이 생긴다.

---

### ADR-009: Swift solution은 Xcode build folder 밖에 저장
**결정**: 대상 저장소에서 Swift LeetCode 풀이는 `leetcode/swift`에 저장한다.

**이유**: 검증 대상 저장소의 `swift/SwiftAlgorithm`은 Xcode build target에 동기화된다. LeetCode 파일은 흔히 `Solution` class와 플랫폼별 helper type을 정의하므로 한 모듈로 컴파일되면 충돌할 수 있다.

**트레이드오프**: Swift LeetCode 풀이는 Xcode project source folder 내부가 아니라 플랫폼 기준 풀이 폴더에 저장된다.

---

### ADR-010: Chrome Web Store 배포는 v2로 연기
**결정**: v1에서는 Chrome Web Store 배포를 계획하지 않는다.

**이유**: 먼저 local 환경에서 Accepted-to-GitHub 흐름을 안정적으로 검증해야 한다. Store 배포에는 아이콘, 스크린샷, privacy policy, 권한 설명, 패키징, 심사 대응이 필요하다.

**트레이드오프**: v1 설치는 Chrome Developer mode에서 수동으로 진행해야 한다.

---

### ADR-011: 외부 API client는 background에 둔다
**결정**: LeetCode와 GitHub API 실행 코드는 `src/background/client` 아래에 둔다. `src/shared`는 타입, 순수 함수, request payload builder, error normalization만 제공한다.

**이유**: content script와 UI가 외부 API 세부사항을 알면 권한, 보안, 장애 처리가 여러 계층으로 퍼진다. Background service worker를 orchestration owner로 두면 API 변경 영향이 좁아진다.

**트레이드오프**: shared 모듈에서 직접 fetch를 재사용할 수 없으며, API 호출은 background 메시징을 통해 우회해야 한다.

---

### ADR-012: LeetCode 조회는 GraphQL 우선으로 격리한다
**결정**: v1은 LeetCode problem metadata와 Accepted submission detail을 GraphQL 우선 client로 조회한다.

**이유**: DOM은 사용자가 본 Accepted 이벤트를 감지하는 데만 안정적이다. 실제 code, language, submission id, metadata는 API response를 기준으로 확정해야 한다.

**트레이드오프**: LeetCode 내부 API shape가 바뀔 수 있으므로 GraphQL query와 response parsing을 client 모듈에 격리해야 한다.

---

### ADR-013: README는 v1에서 항상 갱신한다
**결정**: v1은 solution file, `leetcode/.leetcode-sync/index.json`, `leetcode/README.md`를 항상 같은 GitHub commit에 포함한다. README 갱신을 끄는 UI나 설정은 제공하지 않는다.

**이유**: README가 index의 projection이라는 규칙을 단순하게 유지해야 sync 결과를 예측하기 쉽다. Toggle을 두면 README와 index가 의도적으로 불일치하는 상태가 생긴다.

**트레이드오프**: 사용자는 v1에서 README 자동 갱신을 끌 수 없다. README marker 밖 내용 보존으로 사용자의 수동 작성 영역을 보호한다.

---

### ADR-023: 대상 저장소는 플랫폼 기준 폴더를 우선한다
**결정**: 대상 저장소의 풀이 구조는 `leetcode`, `programmers` 같은 플랫폼 폴더를 먼저 두고, 각 플랫폼 내부를 `swift`, `python` 같은 언어 폴더로 나눈다. v1 자동 sync는 `leetcode`만 갱신하고 Programmers 자동 sync는 v2 후보로 둔다.

**이유**: 사용자의 문제 풀이 저장소는 플랫폼별 진행 현황과 README를 따로 보는 편이 자연스럽다. Swift 풀이도 Xcode build source folder와 분리해야 하므로 플랫폼 기준 루트 폴더가 더 안전하다.

**트레이드오프**: 기존 언어 기준 path로 생성된 파일은 자동 migration하지 않는다. 이후 sync부터 새 플랫폼 기준 path를 사용한다.

---

### ADR-014: 같은 문제/언어는 최신 풀이로 덮어쓴다
**결정**: 같은 problem과 language의 새 Accepted 제출은 기존 solution path를 overwrite하고 index의 해당 language entry를 갱신한다.

**이유**: 대상 저장소는 문제별 최신 풀이를 보여주는 개인 풀이 저장소다. submission별 파일을 만들면 README와 폴더 구조가 빠르게 복잡해진다.

**트레이드오프**: 제출별 코드 파일은 남지 않는다. 변경 이력은 Git commit history로 추적한다.

---

### ADR-015: processed marking은 commit 성공 후에만 한다
**결정**: `processedSubmissions`에는 GitHub commit 성공 후에만 identity를 기록한다. GitHub commit 실패는 retry payload와 history에만 남긴다.

**이유**: commit이 실패한 제출을 processed로 표시하면 이후 재시도나 재감지가 어려워진다. 성공 기준을 GitHub commit 완료로 두면 사용자의 저장소 상태와 extension 상태가 맞는다.

**트레이드오프**: 실패한 제출이 다시 감지될 수 있으므로 identity별 in-flight lock과 retry payload 관리가 필요하다. In-flight lock은 service worker 중단에 대비해 10분 TTL을 둔다.

---

### ADR-016: Storage schema는 version을 포함한다
**결정**: `settings`, `processedSubmissions`, `syncHistory`, `retryPayloads`, `inFlightSyncs`는 모두 version field를 가진 top-level object로 저장한다.

**이유**: v1은 local extension이지만 storage 구조는 릴리즈 후 바꾸기 어렵다. version을 두면 이후 migration을 명시적으로 처리할 수 있다.

**트레이드오프**: 단순 array나 primitive value를 바로 저장하는 것보다 boilerplate가 늘어난다.

---

### ADR-017: Runtime message는 typed union으로 관리한다
**결정**: content, popup, options, background 사이 runtime message는 `src/shared`의 discriminated union 타입으로 정의한다.

**이유**: Manifest V3 extension은 여러 entry point가 메시지로 결합된다. 문자열 event와 느슨한 payload만 쓰면 변경 시 깨진 메시지를 컴파일 단계에서 잡기 어렵다.

**트레이드오프**: 작은 UI action도 message type에 추가해야 하므로 초기 구현량이 조금 늘어난다.

---

### ADR-018: 최소 host permission만 요청한다
**결정**: v1 manifest는 `storage`, `https://leetcode.com/*`, `https://api.github.com/*`, `https://leetcode.com/problems/*` content script match로 제한한다.

**이유**: 개인용 local extension이라도 PAT와 solution code를 다루므로 권한 범위를 좁게 유지해야 한다.

**트레이드오프**: 다른 LeetCode domain이나 플랫폼은 v1에서 동작하지 않는다.

---

### ADR-019: 대상 repository와 branch는 사용자가 선택한다
**결정**: v1은 특정 GitHub repository를 코드 기본값으로 고정하지 않는다. 사용자가 fine-grained PAT를 입력하면 확장은 PAT로 접근 가능한 repository 목록을 보여주고, 사용자가 repository와 branch를 선택한다.

**이유**: 개인 검증 대상은 `zaehorang/Swift_Algorithm`일 수 있지만, 확장 제품은 다른 repository나 다른 사용자의 GitHub 계정에서도 동작해야 한다. 설정 가능한 owner/repo 입력보다 picker를 제공하면 selected repository 권한과 실제 접근 가능 상태를 사용자가 더 명확히 확인할 수 있다.

**트레이드오프**: Options 구현에 repository list, branch list, empty list, pagination, branch create 실패 처리가 추가된다.

---

### ADR-020: Branch 생성은 명시적 사용자 action으로만 수행한다
**결정**: 선택한 repository에 원하는 branch가 없으면 확장이 자동으로 생성하지 않는다. Options의 Create branch action을 사용자가 명시적으로 실행한 경우에만 repository default branch HEAD에서 새 branch ref를 생성한다.

**이유**: branch 이름 오타로 불필요한 branch가 생기는 것을 막고, GitHub write 동작을 사용자의 명확한 의사와 연결하기 위해서다.

**트레이드오프**: 첫 설정 때 branch가 없으면 사용자가 한 번 더 action을 실행해야 한다. Empty repository나 default branch 조회 실패 같은 branch 생성 불가 상태를 UI에서 설명해야 한다.

---

### ADR-021: Accepted 감지는 mutation 범위의 bounded text traversal을 사용한다
**결정**: Content script는 LeetCode DOM class selector나 페이지 전체 텍스트 scan 대신, `MutationObserver`가 전달한 변경 node 범위 안에서 제한된 leaf text 후보를 검사해 Accepted 이벤트를 감지한다.

**이유**: LeetCode 결과 panel은 Accepted 상태, runtime, memory, code, 추천 문제 텍스트를 큰 container 안에 함께 렌더링할 수 있다. 큰 container의 전체 `textContent`를 판정하면 길이 제한이나 generic 문구 때문에 Accepted를 놓치거나 오탐할 수 있다. Class name과 layout도 안정적인 계약으로 보기 어렵다.

**트레이드오프**: DOM 텍스트 패턴 변화에는 여전히 영향을 받는다. 대신 `Accepted n / n testcases passed` 같은 짧은 결과 문구를 우선 감지하고, detector 단위 테스트와 실제 브라우저 수동 검증으로 보완한다.

---

### ADR-022: Content script는 별도 IIFE bundle로 빌드한다
**결정**: Vite main build는 background/options/popup을 만들고, content script는 `vite.content.config.ts`로 별도 IIFE bundle을 생성한다. `npm run build`는 `dist/content/index.js`에 static ESM `import`가 남지 않았는지 검증한다.

**이유**: MV3 background service worker는 module로 실행할 수 있지만, manifest `content_scripts`로 주입되는 script는 classic script로 로드된다. Multi-entry Vite build가 shared chunk를 만들면 content entry에 `import`가 남아 Chrome에서 `Cannot use import statement outside a module` 오류로 content script가 실행되지 않는다.

**트레이드오프**: build step이 둘로 나뉘고 content bundle이 shared code를 중복 포함할 수 있다. 대신 LeetCode page에서 content script가 확실히 실행되고, bundle 회귀를 build verification으로 빠르게 잡을 수 있다.
