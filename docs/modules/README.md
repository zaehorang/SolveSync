# Module 문서

코드 폴더마다 소유 책임, 대표 변경 절차, 비직관적 규칙과 의존 방향을 적은 문서 모음이다. 코드 폴더 안에는 markdown을 두지 않으므로, 폴더를 고치기 전에 여기서 해당 문서를 먼저 읽는다.

| 코드 폴더 | 문서 | 한 줄 |
|---|---|---|
| `src/shared` | [shared.md](shared.md) | 타입, message 계약, path·README·catalog pure logic |
| `src/background` | [background.md](background.md) | MV3 service worker. sync state machine, storage, GitHub·LeetCode client |
| `src/content` | [content.md](content.md) | 플랫폼 페이지 안의 Accepted 감지, editor snapshot, toast |
| `src/options` | [options.md](options.md) | Options 페이지 UI |
| `src/popup` | [popup.md](popup.md) | Popup UI |
| `e2e` | [e2e.md](e2e.md) | Playwright 검증 계층과 Platform E2E Driver |

`workflow/gates/`의 문서는 코드가 아니라 작업 절차에 속하므로 [`workflow/gates.md`](../../workflow/gates.md)에 있다.

각 문서의 절은 Owns, Common changes, Non-obvious, Dependencies 네 개다. 전체 흐름은 [ARCHITECTURE](../ARCHITECTURE.md)가, 제품 규칙은 각 `docs/` 정본이 맡고, 이 문서들은 그것을 링크만 한다. 새 최상위 코드 폴더를 만들면 문서와 이 표의 행을 같은 PR에서 추가한다.
