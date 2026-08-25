# Coding Platform 검증 계층 구축 계획

> **Description**: Sealed E2E, GitHub write, Contract Check와 풀사이클 네 계층을 세우고, 그 전제인 Coding Platform Adapter 구조를 만드는 4단계 실행 계획이다. 계층의 정의와 계약은 [Coding Platform 연동 계약](../../platforms/README.md#검증-공통-계약)이 source of truth이고, 이 디렉터리는 **실행 순서와 인계 정보**만 담는다.

이 디렉터리는 source of truth가 아니다. 계획과 `docs/`가 다르면 `docs/`가 맞다. 각 Phase가 끝나면 그 PR에서 해당 Phase 파일을 지운다. 전부 끝나면 이 디렉터리를 지운다.

## 왜 이 계획이 있나

자동 검증이 module 단위에서 멈춘다. 빌드 산출물을 실제 Chrome에 로드해 보는 단계가 없고, 플랫폼 DOM 계약은 손으로 만든 fake 객체로만 검증된다. 그래서 **플랫폼이 마크업을 바꾸면 테스트는 전부 통과한 채로 제품만 조용히 감지를 멈춘다.**

근거의 강도도 세 플랫폼이 다르다.

| | 관찰 강도 | 근거 일자 |
|---|---|---|
| SWEA | 실증 (실제 제출) | 2026-08-18 |
| Programmers | post-state 관찰 | 2026-08-04 / `textarea#code`는 2026-05-27 |
| LeetCode | **가정** | 기록 없음 |

SWEA 실증에서 문서가 "관찰 사실"로 적어둔 항목 하나가 틀린 것으로 드러난 적이 있다. `textarea#textSource`가 비어 있다고 단정했지만 실제로는 초기 code가 들어 있고 editor 변경이 반영되지 않았다. 결론은 그대로였지만 근거가 달랐다. 나머지 두 플랫폼에 같은 종류의 오차가 있어도 지금 테스트는 전부 통과한다.

## Phase

```
Phase 1 (캡처)  ─┐
                 ├─→ Phase 3 (하네스) ─→ Phase 4 (플랫폼 3 병렬)
Phase 2 (완료)  ─┘
```

Phase 1과 2가 끝났다. 세 Coding Platform Adapter가 `src/content/platforms/`에 있고 controller에 플랫폼 분기가 없다. 세 플랫폼의 정답·오답 fixture는 `e2e/fixtures/{platform}/`에 있다. Phase 3의 선행이 모두 충족됐다.

| | 파일 | 담당 | 선행 |
|---|---|---|---|
| 1 | **완료** | — | — |
| 2 | **완료** | — | — |
| 3 | [phase-3-harness.md](phase-3-harness.md) | 에이전트 1 | Phase 1, 2 |
| 4 | [phase-4-platforms.md](phase-4-platforms.md) | 에이전트 3 (병렬) | Phase 3 |

Phase 1이 남긴 실측은 각 플랫폼 문서의 관찰 강도 표기에 반영했다. 계획 파일은 완료와 함께 지웠다.

**Phase 4의 병렬은 Phase 2가 끝나야 성립했다.** 이전에는 세 플랫폼 로직이 하나의 controller 파일에 있어 세 에이전트가 같은 파일을 고쳐야 했다.

## 확정된 결정

되짚지 말 것. 각 항목은 tradeoff를 검토한 뒤 정해졌다.

| 항목 | 결정 | 이유 |
|---|---|---|
| 브라우저 자동화 | Playwright | MV3 unpacked 로드, 요청 가로채기, 전용 프로필을 한 도구로 덮는다 |
| Sealed fixture 출처 | 실제 page 캡처 | 손으로 지은 fixture는 adapter와 함께 틀린다 |
| GitHub 대상 | Verification Repository (전용) | 설정 실수로 실사용 Sync Repository에 쓸 경로 자체를 없앤다 |
| Coding Platform 계정 | 실사용 계정 + 플랫폼별 기준 문제 고정 | 기준 문제가 실사용 풀이와 겹치지 않으면 계정을 나눌 필요가 없다 |
| GitHub write 계층 | CI, 매 PR, fine-grained token | 회귀는 코드가 바뀔 때 잡아야 한다 |
| 풀사이클 제출 | 에이전트가 자동, `E2E_LIVE_SUBMIT=1` + 사용자 승인 | 재현 가능해야 릴리스마다 같은 것을 본다 |
| 격리 수단 | Verification Profile | Sync Deduplication Key는 확장 설치 단위로 저장된다. branch를 나눠도 key는 안 나뉜다 |

## 미해결

착수 시점에 실물로 확인해야 한다. 종이 위에서 정하지 않는다.

1. **GitHub write 계층의 token 주입.** `chrome.storage.local`에 auth state를 직접 쓰기 vs `BackgroundRuntimeOptions.authManager` 주입. 후자는 프로덕션 번들이 아닌 것을 로드하게 되어 "테스트 전용 변형 금지"와 충돌한다. 전자를 택하되 storage schema 계약 테스트를 붙이는 쪽이 현재 판단이다. Phase 3에서 확정한다.
2. **`--headless=new`에서 MV3 확장 로드가 CI에서 안정적인가.** 불안정하면 xvfb headed로 간다. Phase 3에서 확정한다.
3. **Programmers와 LeetCode의 기준 문제.** SWEA는 1206(`AV134DPqAA8CFAYh`)으로 확정됐다. Phase 1에서 정하고 플랫폼 문서에 기록한다.

## 절대 남기지 않을 것

캡처, fixture, log, screenshot, PR body, 이슈 코멘트 어디에도 두지 않는다.

- solution code 원문 (줄 수·길이·해시로만 남긴다)
- GitHub token, Device Flow device code, legacy PAT
- Coding Platform cookie와 session token
- 계정 식별자
- 문제 설명 전문

alert layer의 UI 문구는 사용자 데이터가 아니므로 보존한다.
