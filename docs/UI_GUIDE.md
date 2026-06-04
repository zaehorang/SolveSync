# UI 가이드

> **Description**: 화면 구성, 상태 표현, 문구, 스타일, 접근성 기준을 정리한 문서다.

## 제품 UI 원칙
1. SolveSync는 마케팅 제품이 아니라 매일 쓰는 조용한 개발 도구처럼 느껴져야 한다.
2. 모든 화면은 현재 작업에 집중한다. GitHub 연결, sync 상태 확인, 실패 retry, Auto Sync 일시 중지가 핵심이다.
3. 시각적 질감은 상태와 구조를 돕기 위한 보조 수단이다. 장식보다 짧은 상태 문구, 안정적인 control, 명확한 복구 action을 우선한다.
4. 사용자를 놀라게 하는 navigation을 피한다. 사용자가 link를 클릭하지 않는 한 GitHub 탭을 자동으로 열지 않는다.
5. Liquid Glass 방향은 Apple HIG의 material, hierarchy, clarity 원칙을 참고하되 Apple 제품 UI를 복제하지 않는다.

## UI Surface
SolveSync의 사용자 화면은 세 가지다.
- Options page
- Popup page
- Problem page sync popup/toast

Problem page sync popup/toast는 단순 알림이 아니라 sync 진행, 성공, 실패 복구를 보여주는 핵심 surface다.

## Domain Naming In UI
UI copy의 표준 도메인 용어는 `CONTEXT.md`를 따른다. Options, Popup, Toast에서는 Sync Repository, Sync Branch, Sync History, Retry Bundle, Solution README, Solution Catalog, Coding Platform을 기준으로 표현한다.

사용자에게 내부 storage key나 runtime message type을 노출하지 않는다. 단, Security disclosure에서는 Retry Bundle이 Accepted solution code를 임시 저장할 수 있다는 사실을 명확히 알린다.

## Language / Localization
v1 UI는 영어와 한국어를 지원한다.

Language preference:
- 기본값은 `system`이다.
- `system`은 브라우저 언어가 `ko` 또는 `ko-*`이면 한국어, 그 외에는 영어를 사용한다.
- Options에서 `System`, `English`, `한국어` 중 하나를 선택할 수 있어야 한다.
- 사용자가 `English` 또는 `한국어`를 명시적으로 선택하면 브라우저 언어보다 사용자 선택을 우선한다.

Implementation rules:
- 사용자에게 보이는 문자열은 i18n key 기반으로 관리한다.
- Options, Popup, Toast 안에 영어와 한국어 hard-coded 문구가 섞여 있으면 안 된다.
- GitHub, LeetCode, Programmers, PAT, Auto Sync, Swift, Python3 같은 제품/Coding Platform 용어는 번역하지 않아도 된다.
- `document.documentElement.lang`은 실제 표시 locale에 맞춰 `en` 또는 `ko`로 설정한다.

## Options Page
목적: 첫 설정과 GitHub 연결 관리.

구조:
- 전체 화면은 큰 Liquid Glass shell 안에 compact settings layout으로 구성한다.
- 넓은 viewport에서는 sidebar 또는 section navigation을 사용할 수 있다.
- 좁은 viewport에서는 section이 위에서 아래로 자연스럽게 쌓여야 한다.
- marketing hero나 큰 홍보 영역을 만들지 않는다.
- v1은 Manifest `options_page` 기반 full-page Options를 사용한다.
- PAT, repository/branch 선택, branch 생성, connection test 같은 긴 설정 작업은 Popup이 아니라 Options에서 수행한다.
- 첫 설정 흐름은 `GitHub PAT → Load repositories → Sync Repository → Sync Branch → Create branch → Connection test → Save` 순서로 보여준다.
- embedded options(`options_ui`)나 side panel 전환은 별도 제품 결정 없이는 하지 않는다.

필수 section:
- GitHub Connection: PAT, repository loading, branch loading, branch create, connection test.
- General: Auto Sync, Language.
- Security: PAT와 Retry Bundle disclosure.
- About: 제품 이름, local unpacked v1 성격, backend 없음 안내.
- Save controls.

필수 field:
- GitHub PAT input. 기본은 masked display다.
- Sync Repository picker. 설정이 없으면 비어 있고, PAT 입력 후 접근 가능한 본인 owner repository 목록에서 선택한다.
- Sync Branch picker. Sync Repository 선택 전에는 disabled 상태이며, Sync Repository 선택 후 branch 목록에서 선택한다. 기본 선택값은 repository default branch다.
- Auto Sync switch.
- Language segmented control.

PAT checklist는 다음 내용을 포함해야 한다.
- Fine-grained personal access token을 생성한다.
- Sync Repository만 선택한다.
- Contents read/write 권한을 부여한다.
- Metadata는 GitHub가 제공하는 read-only 기본 권한을 사용한다.
- 사용자가 감당할 수 있는 만료일을 설정한다.

Sync Repository picker:
- PAT 입력 후 Load repositories action을 제공한다.
- 목록은 입력된 PAT로 접근 가능한 본인 owner repository만 보여준다.
- 목록이 비어 있으면 token에 본인 owner repository가 포함되어 있는지 확인하라는 상태를 보여준다.
- 목록이 길 수 있으므로 검색 가능한 UI를 제공한다.
- repository를 자동 선택하지 않는다.

Sync Branch picker:
- Sync Repository 선택 후 branch 목록을 불러온다.
- repository default branch를 기본 선택값으로 표시한다.
- 원하는 Sync Branch가 없으면 Create branch action을 제공한다.
- Create branch는 사용자가 명시적으로 실행한 경우에만 동작한다.
- branch 생성 실패 시 원인과 다음 행동을 보여준다.

Security disclosure에는 다음 사용자 고지를 표시한다.
- PAT는 Chrome extension local storage에 저장된다.
- 실패 Retry Bundle은 Accepted solution code를 local storage에 임시 저장할 수 있다.
- Retry Bundle은 최대 20개, 최대 7일 보관하고 retry 성공 후 삭제한다.
- v1 확장은 별도 backend server를 운영하지 않는다.
- Solution code는 설정된 GitHub sync commit을 위해서만 GitHub로 전송된다.
- LeetCode/Programmers 문제 설명 전문은 저장하지 않는다.

Connection test 상태:
- Not tested.
- Testing.
- Connected.
- No owned repositories.
- Repository not found.
- Branch not found.
- Branch created.
- Branch create failed.
- Auth failed.
- Token expired.
- Rate limited.
- Network failed.

## Popup Page
목적: 빠른 제어와 운영 상태 확인.

Chrome action popup sizing:
- Chrome action popup은 일반 tab viewport가 아니라 popup content 기준으로 자동 크기 조정된다.
- 공식 popup 크기 범위는 `25x25`부터 `800x600`px까지다.
- SolveSync toolbar popup 기준 폭은 `380px`이다.
- popup root sizing에는 `100vw`, `min(..., 100vw)` 같은 viewport 의존 폭을 사용하지 않는다.
- popup root에는 명확한 fixed/min content width를 두고, 내부 콘텐츠가 그 폭 안에서 줄바꿈되게 한다.

필수 section:
- 상단 setup/status card.
- Auto Sync toggle.
- GitHub connection summary.
- Sync Repository와 Sync Branch summary.
- 최근 Sync History. 최신 항목을 위에 둔다.
- 실패 항목 선택 시 failure detail panel.
- retry 가능한 실패의 Retry button.
- Options link.

Status card:
- `Ready to sync`, `GitHub connection required`, `Repository required`, `Branch required`, `Auto Sync off`, `Connection not tested`, `Sync failed` 같은 현재 운영 상태를 짧게 보여준다.
- status card는 color만으로 상태를 전달하지 않는다. icon, label, detail text를 함께 사용한다.

History item 내용:
- Coding Platform label. `LeetCode` 또는 `Programmers`를 짧게 표시한다.
- Problem title.
- Language.
- Status badge.
- Time.
- Commit link. 사용 가능한 경우만 표시한다.
- File link. 사용 가능한 경우만 표시한다.
- 실패한 경우 짧은 error summary.
- Unsupported language인 경우 commit이 만들어지지 않았다는 짧은 이유.
- 같은 Coding Platform의 같은 문제에 대해 여러 Sync History event가 있더라도 Popup 카드 안에서는 language별 최신 row 하나만 보여준다.
- Commit/File link는 language row의 primary action 영역에 두고, time 같은 낮은 우선순위 metadata와 붙어 보이지 않게 분리한다.

History limit:
- Sync History는 최근 20개 항목만 보여준다.
- Sync History가 없으면 Accepted submission이 sync된 뒤 여기에 표시된다는 조용한 empty state를 보여준다.

Retry behavior:
- Retry Bundle이 있을 때만 Retry button을 보여준다. v1에서 일반 수동 sync button은 제공하지 않는다.
- Retry 중에는 button을 disable하고 진행 중 text를 보여준다.
- Retry 성공 후 item에 commit link와 file link를 반영한다.
- Retry 실패 후 Retry Bundle은 유지하고 error detail을 갱신한다.
- Retry Bundle이 만료되었거나 삭제된 항목에는 Retry button을 숨기고 Options 또는 문제 재제출 같은 다음 행동을 안내한다.

## Problem Page Sync Popup / Toast
목적: 문제 풀이 흐름을 끊지 않는 즉시 feedback과 복구 action 제공.

위치:
- LeetCode와 Programmers 문제 페이지 오른쪽 아래.
- Fixed position.
- 일반적인 desktop width에서 code editor control, run/submit button, result panel action을 가리지 않아야 한다.
- 모바일 또는 좁은 viewport에서는 `calc(100vw - safe margin)` 안에 들어와야 한다.

Toast states:
- Setup required.
- Auto Sync off.
- Syncing.
- Retrying.
- Synced.
- Unsupported language.
- Failed.

State behavior:
- Setup required: GitHub 연결이 필요하다는 짧은 설명과 `Open Options` primary action을 보여준다. Auto dismiss 하지 않는다.
- Auto Sync off: commit이 만들어지지 않았음을 알려준다. `Open Options` action을 제공할 수 있고 짧은 시간 뒤 dismiss한다.
- Syncing: 문제명과 언어를 보여주고 spinner 또는 thin progress indicator를 표시한다. action은 제공하지 않는다.
- Retrying: retry 대상 문제명과 언어를 보여주고 진행 중 indicator를 표시한다.
- Synced: `Synced to GitHub` title, problem detail, `Commit`, `File`, `Dismiss` action을 제공한다. 짧은 시간 뒤 auto dismiss한다.
- Unsupported language: Swift와 Python3만 sync된다는 이유를 짧게 보여주고 auto dismiss한다.
- Failed: 짧은 실패 원인, 가능한 경우 `Retry`, 설정 문제 복구를 위한 `Open Options` action을 제공한다. Auto dismiss 하지 않는다.

Toast rules:
- 문구는 짧게 유지한다.
- primary action은 하나만 강조한다.
- Success 상태는 commit link와 file link를 보여줄 수 있다.
- Failure 상태는 retry 가능 여부를 명확히 구분한다.
- 긴 technical stack trace는 toast에 표시하지 않고 Popup의 details에 둔다.

## Visual Style
SolveSync는 Liquid Glass inspired utility UI를 사용한다.

핵심 방향:
- frosted/translucent glass shell.
- 얇은 white hairline border.
- soft shadow와 subtle depth.
- 아주 옅은 blue, green, lavender pastel wash.
- compact settings rows.
- pill segmented controls.
- 작은 icon tile과 status badge.

권장 token:
- Page background: `#eef4fb`
- Pastel wash blue: `#dbeafe`
- Pastel wash green: `#dcfce7`
- Pastel wash lavender: `#ede9fe`
- Glass surface: `rgb(255 255 255 / 0.72)`
- Glass elevated surface: `rgb(255 255 255 / 0.84)`
- Glass border: `rgb(255 255 255 / 0.72)`
- Hairline border: `rgb(148 163 184 / 0.28)`
- Primary text: `#0f172a`
- Secondary text: `#475569`
- Muted text: `#64748b`
- Accent: `#2563eb`
- Success: `#16a34a`
- Error: `#dc2626`
- Warning: `#d97706`

Material rules:
- Glass surface 위의 foreground content는 충분히 불투명해야 한다.
- `backdrop-filter`를 사용할 수 있지만 text contrast를 희생하지 않는다.
- content toast의 shadow DOM 안에서는 필요한 token을 자체 선언한다.
- Panel/card radius는 8px 이하를 기본으로 한다. 큰 shell만 최대 16px까지 허용한다.
- Purple/blue-purple gradient가 UI 전체를 지배하면 안 된다.

## Components
Buttons:
- Save, Connection Test, Retry는 primary button을 사용한다.
- Options navigation과 link성 action은 secondary button을 사용한다.
- 비동기 작업 중인 button은 disable한다.
- button label은 popup width 안에서 잘리지 않아야 한다.

Icon buttons:
- Close, settings, details, external link 같은 compact action은 icon button을 사용할 수 있다.
- icon button에는 접근 가능한 label을 제공한다.

Inputs:
- 모든 input에는 보이는 label을 둔다.
- validation message는 관련 field 근처에 표시한다.
- PAT input은 show/hide toggle을 지원한다.

Segmented controls:
- Language selection은 `System`, `English`, `한국어` segmented control을 사용한다.
- Keyboard 접근이 가능해야 하고 현재 선택이 text와 state로 드러나야 한다.

Toggles:
- Auto Sync는 명확한 on/off switch를 사용한다.
- 상태 text는 control 옆 또는 같은 settings row 안에 표시한다.

Status badges:
- `Synced`, `Failed`, `Retrying`, `Auto Sync off`, `Unsupported` 같은 짧은 status에 사용한다.
- badge는 색상만으로 의미를 전달하지 않고 text를 포함한다.

Links:
- Commit link와 file link는 새 tab에서 연다.
- Sync 성공 후 link를 자동으로 열지 않는다.

## Text Guidelines
- 직접적이고 운영적인 문구를 사용한다.
- 과장된 축하 문구보다 `Synced to GitHub`를 선호한다.
- 모호한 setup 메시지보다 `GitHub connection required`처럼 원인을 드러낸다.
- Error message는 가능한 경우 사용자가 할 수 있는 다음 조치를 포함한다.
- Toast text에는 구현 세부사항을 길게 설명하지 않는다.
- 한국어 문구도 짧고 명령형 action을 분명히 한다.

## Accessibility
- 모든 form control에는 보이는 label이 있어야 한다.
- Button과 link는 keyboard로 접근 가능해야 한다.
- 상태를 색상만으로 전달하지 않는다.
- Success와 error text는 읽을 수 있는 contrast를 가져야 한다.
- Glass/translucent UI는 배경이 복잡해도 foreground layer의 contrast를 유지해야 한다.
- Popup content는 일반적인 extension popup width에서 horizontal scroll 없이 보여야 한다.
- Popup sizing 검증은 실제 Chrome toolbar popup에서 수행한다. `file://`, localhost, 일반 browser viewport만으로 완료하지 않는다.
- 한국어와 영어 모두 가장 긴 버튼/상태 문구가 잘리지 않아야 한다.
- Motion은 절제한다. Syncing spinner/progress animation은 과하지 않아야 하며 reduced motion 환경에서 의미가 사라지면 안 된다.

## 금지 패턴
사용하지 않는다.
- Marketing hero section.
- Gradient text.
- UI 전체를 지배하는 decorative background gradient.
- Decorative orb, glow blob, bokeh background.
- 낮은 contrast의 blur-only glass panel.
- Animated glow effect.
- Card 안에 또 큰 card를 넣는 구조.
- 카탈로그/마케팅 card grid를 Options 또는 Popup의 기본 정보 구조로 사용하는 방식.
- Sync마다 GitHub tab을 자동으로 여는 동작.
- Auto Sync off 상태에서 일반 수동 sync button을 제공하는 동작.
- Toast에 긴 technical stack trace를 표시하는 방식.
