# Phase 3 — 검증 하네스와 GitHub write 계층

> **선행**: Phase 1(fixture), Phase 2(Adapter).
> **산출**: Playwright 배선, `PlatformE2EDriver` 인터페이스, Sealed·Live 공통 spec, GitHub write 계층 전체, CI job.

## 목표

플랫폼별 spec을 세 번 쓰지 않도록 **공통 spec + 드라이버 주입** 구조를 세우고, SWEA 드라이버 하나로 그 구조가 실제로 도는 것을 증명한다. Phase 4의 세 에이전트는 드라이버만 채운다.

## Phase 1이 넘긴 것

Phase 1이 끝났다([PR #77](https://github.com/zaehorang/SolveSync/pull/77)). Sealed E2E의 입력이 준비돼 있으므로 여기서부터는 만들어 쓰지 말고 있는 것을 쓴다.

### fixture

`e2e/fixtures/{platform}/{accepted,rejected}.json` 여섯 개다. 각각 실제 제출 한 번의 mutation 기록이고, `recording.batches[].mutations`와 `watchedBefore`/`watchedAfter`가 들어 있다. 들여쓰기 없는 단일 줄 JSON이다 — mutation이 6천 건대라 pretty-print 구조 overhead만으로 파일이 두 배 넘게 불어난다.

| fixture | 담긴 판정 |
| --- | --- |
| `leetcode/accepted` | `Judging...` → `Accepted` (`characterData`) |
| `leetcode/rejected` | `Pending...` → `Wrong Answer` (`characterData`) |
| `programmers/accepted` | `.modal-title` = `정답입니다!` |
| `programmers/rejected` | `.modal-title` = `틀렸습니다!` |
| `swea/accepted` | `축하합니다. Pass입니다.제출이 완료되었습니다.` |
| `swea/rejected` | `오답채점용 input 파일로 채점한 결과 fail 입니다....` |

**fixture에 solution code 원문은 없다.** 회수 경로 자체가 막혀 있고 저장 직전 검사가 한 번 더 본다. 재생 spec을 쓸 때 code를 fixture에서 꺼내려 하지 말고 `e2e/fixtures/solutions/`를 쓴다.

### 재생할 때 반드시 알아야 할 것

캡처가 드러낸 것들이다. 각 플랫폼 문서에 근거와 함께 적혀 있다.

- **Programmers는 결과 내용과 visibility가 서로 다른 batch로 온다.** batch N에서 `.modal-title`이 채워지지만 root는 아직 `display: none`이고, batch N+1에서 visibility만 바뀐다. **재생 spec이 두 batch를 하나로 합치면 판정이 성립하지 않는다.** 구현이 `state`를 batch 사이에 들고 가는 덕에 통과하는 구조다.
- **LeetCode 판정은 node 추가가 아니라 대기 text의 제자리 교체다.** 그리고 page에는 `Accepted 23,208,748/40M` 같은 통계 copy가 있어 문자열 검색으로 판정을 찾으면 안 된다.
- **SWEA는 `childList` node 추가**이고 layer 전체 text의 맨 앞에 Accepted 접두사가 온다.

### 캡처를 다시 돌려야 할 때

```bash
CAPTURE_PLATFORM=leetcode CAPTURE_OUTCOME=accepted npm run e2e:capture
npm run e2e:capture:swea   # SWEA는 로그인과 캡처를 한 세션에서 끝낸다
```

SWEA는 `.env`에 `E2E_SWEA_ID`/`E2E_SWEA_PASSWORD`가 있으면 로그인까지 자동이고, 없으면 사람이 로그인할 때까지 기다린다. `.env`는 `.gitignore`에 있다. LeetCode·Programmers는 Verification Profile에 쿠키가 남아 `npm run e2e:login`을 한 번만 하면 된다.

**제출 전에 두 개의 문이 있다.** editor가 넣으려던 code를 실제로 들고 있는지 확인하고, SWEA는 채점 제출 없이 먼저 실행해 예제 입출력과 대조한다. 둘 중 하나라도 어긋나면 제출하지 않는다. 이 문들이 실제로 잘못된 제출을 여러 번 막았으므로 우회하지 않는다.

### 열린 질문

Phase 3을 막지는 않지만 재생 spec을 짤 때 전제로 삼으면 안 되는 것들이다.

- 두 번째 Accepted에서 결과 node가 재사용되는지 — [#78](https://github.com/zaehorang/SolveSync/issues/78)
- 긴 풀이에서 Programmers `textarea#code`가 잘리지 않는지 — [#79](https://github.com/zaehorang/SolveSync/issues/79)

## 확인된 이음매

종이 위 추측이 아니라 코드에서 확인한 것들이다. 여기서 벗어나면 다시 확인한다.

### Sealed E2E의 관측점 — Sync History

`content:accepted_detected`가 service worker에 도달했는지를 `onMessage` 후킹으로 보지 않는다. service worker는 잠들었다 깨어나므로 evaluate로 심은 전역이 날아간다.

`src/background/sync.ts`가 **성공·실패 모든 분기**에서 `recordAndBroadcast`로 Sync History를 `chrome.storage.local`에 남긴다(200, 214, 238, 254, 271, 351, 381행 등). GitHub 미설정 상태로 돌리면 실패 entry가 남고 거기에 platform·problem·language가 들어 있다.

→ **Sync History entry를 읽는다.** service worker 재시작에도 살아남고, "도달했다"보다 강한 것을 본다 — payload가 orchestration까지 온전한 형태로 갔는지.

### GitHub write 계층의 진입 경로 — 확장 options page

service worker가 보낸 메시지는 자기 `onMessage`로 돌아오지 않는다. SW 안에서 `sendMessage`를 부르는 방식은 **동작하지 않는다.**

`chrome-extension://<id>/options/index.html`을 열고 거기서 `chrome.runtime.sendMessage`를 보내면 `src/background/runtime.ts:76`의 리스너에 정상 도달한다.

```ts
// src/background/runtime.ts:113
case "content:accepted_detected":
  return success(await context.orchestrator.handleAcceptedDetected(message.payload, {
    tabId: sender.tab?.id          // optional
  }));
```

`sender.tab`이 없어도 `tabId: undefined`로 흘러가고 `runtime.ts:361`이 이를 가드하므로 **toast만 생략되고 sync 경로는 그대로 돈다.** 제품 코드를 고치지 않고 content script도 플랫폼 fixture도 없이 orchestration 전 구간을 태울 수 있다.

> **남길 사실**: `content:accepted_detected`는 sender가 content script인지 검사하지 않는다. `externally_connectable`이 없어 외부 web page는 못 보내지만 같은 확장의 어느 context든 보낼 수 있다. **이 계층은 그 느슨함에 의존한다.** 나중에 sender 검증을 조이면 함께 고쳐야 한다. PR body에 남긴다.

### settings 주입은 제품 경로로

`settings:write` 메시지 케이스가 `runtime.ts`에 있다. Verification Repository와 branch는 이걸로 심는다. storage schema를 손으로 쓰면 schema가 바뀔 때 조용히 깨진다.

### tsconfig는 분리한다

root `tsconfig.json`은 `include: ["src", …]`이고 `types: ["chrome", "vitest/globals"]`다. `e2e`를 여기 넣으면 Playwright 타입과 chrome 타입이 한 program에 섞인다. `e2e/tsconfig.json`을 따로 둔다.

`vitest.config.ts`는 `include: ["src/**/*.test.ts"]`라 `e2e/`를 줍지 않는다. 충돌 없음 — 확인됨.

## 드라이버 인터페이스

```ts
// e2e/drivers/types.ts
export interface PlatformE2EDriver {
  readonly platform: CodingPlatform;
  fixture(): { url: string; idle: string; accepted: string; rejected: string };
  syntheticPayload(): AcceptedDetectedPayload;      // GitHub write 계층이 쓴다
  liveUrl(): string;                                 // 기준 문제
  assertContract(page: Page): Promise<void>;         // Contract Check
  submit(page: Page, code: string): Promise<void>;   // 풀사이클
}
```

`e2e/`는 `src/` 밖이라 vite 진입점에 걸리지 않는다. **제출 버튼처럼 제품이 쓰지 않는 selector가 제품 번들에 실릴 걱정이 구조적으로 없다.** 별도 구획 분리나 build 검사가 필요 없는 이유다.

## GitHub write 계층

- 대상은 **Verification Repository**. 사용자 Sync Repository를 쓰지 않는다.
- token은 그 저장소 한 곳에만 쓰기 권한을 가진 fine-grained token. `src/background/client/github.ts:751`이 `Bearer ${accessToken}`으로 호출하므로 인증 방식 차이는 API 호출 경로에 영향이 없다. App/Device Flow 인증 경로 자체는 풀사이클이 실증한다.
- **실행마다 고유 branch**(`e2e/{run_id}`)를 하네스가 만들고 끝나면 지운다. 동시 PR이 서로를 밟지 않는다. 제품이 branch를 만드는 것이 아니므로 자동 생성 금지 규칙은 그대로다.
- 검증 대상: commit이 Solution File·Solution README·Solution Catalog를 함께 바꾸는가, 문제 번호·제목·code가 payload와 맞는가.

## 진행 상황

**하네스 배선은 끝났다.** `e2e/support/`와 `e2e/harness.spec.ts`가 있고 CI에 비차단 job으로 붙어 있다. 남은 것은 아래 둘이다.

- Sealed E2E spec — Phase 1의 캡처 fixture가 있어야 쓸 수 있다.
- GitHub write 계층 — Verification Repository와 token이 있어야 쓸 수 있다.

## 해결된 미해결 항목

**headless MV3 확장 로드는 안정적이다.** 단 조건이 있다.

Playwright의 `headless: true` 기본값은 `chromium_headless_shell` 바이너리를 쓰는데 **그 바이너리는 확장을 지원하지 않는다.** service worker가 영영 기동하지 않고 timeout으로만 드러나서 원인이 보이지 않는다. `channel: "chromium"`을 명시해 정식 Chromium을 쓰면 뜬다.

xvfb는 필요 없다. 로컬에서 3개 spec이 5초 안에 끝난다.

## 남은 미해결 — 착수 직후 실물로 정한다

**token 주입 방법.** `chrome.storage.local`에 auth state 직접 쓰기 vs `BackgroundRuntimeOptions.authManager` 주입. 후자는 프로덕션 번들이 아닌 것을 로드하게 되어 "테스트 전용 변형 금지"와 충돌한다. **전자를 택하되 storage schema 계약 테스트를 붙이는 쪽이 현재 판단**이나, 실제로 심어 보고 확정한다.

## CI

- 하네스는 `e2e` job으로 배선돼 있고 `continue-on-error: true`다. 안정화 후 필수로 승격한다.
- 정식 Chromium을 받아야 한다(`npx playwright install --with-deps chromium`).
- Sealed E2E는 secret 없이 돌아야 한다. fork PR에서도 도는 것이 두 계층을 합치지 않는 이유다.
- GitHub write는 fine-grained token을 Actions secret으로 받는다. fork PR에서는 secret이 없어 자동 차단된다.

## 완료 조건

- [ ] 빌드된 `dist/`를 unpacked로 로드해 실제 도메인 URL에서 content script 주입이 확인된다.
- [ ] **테스트 전용 manifest 변형 없이** 프로덕션 빌드 산출물을 그대로 검증한다.
- [ ] SWEA MAIN world bridge 왕복이 실제 Chrome에서 검증된다.
- [ ] 가상 스크롤 상태에서 화면 밖 줄을 포함한 전체 code가 bridge를 통해 전달된다.
- [ ] bridge 미주입 시 `swea_extract_failed`로 수렴한다.
- [ ] Sealed E2E가 Sync History entry로 판정하며 실제 네트워크를 타지 않는다.
- [ ] GitHub write가 Verification Repository의 고유 branch에 commit을 만들고 끝나면 지운다.
- [ ] Sealed E2E가 secret 없이 통과한다.
- [ ] 미해결 2건의 답이 PR body에 기록되고 그 결과로 실행 방식이 확정된다.
- [ ] 각 계층이 잡지 못하는 것이 문서에 남는다.
