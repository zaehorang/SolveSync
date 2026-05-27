# UI 가이드

## 제품 UI 원칙
1. 확장은 마케팅 제품이 아니라 매일 쓰는 조용한 개발 도구처럼 느껴져야 한다.
2. 모든 화면은 현재 작업에 집중한다. GitHub 연결, sync 상태 확인, 실패 retry, Auto Sync 일시 중지가 핵심이다.
3. 장식보다 짧은 상태 문구, 안정적인 control, 명확한 복구 action을 우선한다.
4. 사용자를 놀라게 하는 navigation을 피한다. 사용자가 link를 클릭하지 않는 한 GitHub 탭을 자동으로 열지 않는다.

## UI Surface
PS-LP-Sync의 사용자 화면은 세 가지다.
- Options page
- Popup page
- LeetCode page toast

## Options Page
목적: 첫 설정과 GitHub 연결 관리.

필수 section:
- 프로젝트 제목과 한 줄 설명.
- GitHub connection settings.
- Fine-grained PAT checklist.
- Connection test result.
- Security disclosure.
- Save controls.

필수 field:
- GitHub PAT input. 기본은 masked display다.
- Owner input. 설정이 없으면 `zaehorang`을 기본값으로 사용한다.
- Repository input. 설정이 없으면 `Swift_Algorithm`을 기본값으로 사용한다.
- Branch input. 설정이 없으면 `main`을 기본값으로 사용한다.
- Auto Sync enabled checkbox 또는 switch.

PAT checklist는 다음 내용을 포함해야 한다.
- Fine-grained personal access token을 생성한다.
- 대상 저장소만 선택한다.
- Contents read/write 권한을 부여한다.
- Metadata는 GitHub가 제공하는 read-only 기본 권한을 사용한다.
- 사용자가 감당할 수 있는 만료일을 설정한다.

Security disclosure는 다음을 명시해야 한다.
- PAT는 Chrome extension local storage에 저장된다.
- 실패 retry payload는 Accepted solution code를 local storage에 임시 저장할 수 있다.
- retry payload는 최대 20개, 최대 7일 보관하고 retry 성공 후 삭제한다.
- v1 확장은 별도 backend server를 운영하지 않는다.
- Solution code는 설정된 GitHub sync commit을 위해서만 GitHub로 전송된다.

Connection test 상태:
- Not tested.
- Testing.
- Connected.
- Repository not found.
- Branch not found.
- Auth failed.
- Token expired.
- Rate limited.
- Network failed.

## Popup Page
목적: 빠른 제어와 운영 상태 확인.

필수 section:
- Auto Sync toggle.
- Setup status summary.
- 최근 sync history. 최신 항목을 위에 둔다.
- 실패 항목 선택 시 failure detail panel.
- retry 가능한 실패의 Retry button.
- Options link.

History item 내용:
- Problem title.
- Language.
- Status.
- Time.
- Commit link. 사용 가능한 경우만 표시한다.
- File link. 사용 가능한 경우만 표시한다.
- 실패한 경우 짧은 error summary.
- Unsupported language인 경우 commit이 만들어지지 않았다는 짧은 이유.

History limit:
- 최근 20개 record만 보여준다.
- history가 없으면 Accepted submission이 sync된 뒤 여기에 표시된다는 조용한 empty state를 보여준다.

Retry behavior:
- Retry payload가 있을 때만 Retry button을 보여준다. v1에서 일반 수동 sync button은 제공하지 않는다.
- Retry 중에는 button을 disable하고 진행 중 text를 보여준다.
- Retry 성공 후 item에 commit link와 file link를 반영한다.
- Retry 실패 후 payload는 유지하고 error detail을 갱신한다.
- retry payload가 만료되었거나 삭제된 항목에는 Retry button을 숨기고 Options 또는 문제 재제출 같은 다음 행동을 안내한다.

## LeetCode Toast
목적: 문제 풀이 흐름을 끊지 않는 즉시 feedback.

위치:
- LeetCode 페이지 오른쪽 아래.
- Fixed position.
- 일반적인 desktop width에서 code editor control이나 submit button을 가리지 않아야 한다.

Toast states:
- Setup required.
- Auto Sync off.
- Syncing.
- Synced.
- Unsupported language.
- Failed.

Toast rules:
- 문구는 짧게 유지한다.
- primary action은 하나만 보여준다.
- Success 상태는 commit link와 file link를 보여줄 수 있다.
- Failure 상태는 Popup 또는 Options를 여는 action을 보여줄 수 있다.
- Success toast는 짧은 시간 뒤 auto dismiss 한다. Failure toast는 더 오래 유지한다.

## Visual Style
- 절제된 neutral palette를 사용한다.
- 성공에는 green, error에는 red만 사용한다.
- purple 또는 blue-purple gradient를 피한다.
- decorative blob, glassmorphism, glow effect, 과하게 둥근 card, marketing hero style을 사용하지 않는다.
- card와 panel radius는 8px 이하로 유지한다.
- 도구 UI에 맞는 compact spacing을 사용한다.

권장 색상:
- Page background: `#f8fafc`
- Panel background: `#ffffff`
- Border: `#d7dde5`
- Primary text: `#111827`
- Secondary text: `#4b5563`
- Muted text: `#6b7280`
- Success: `#15803d`
- Error: `#b91c1c`
- Warning: `#b45309`
- Link: `#2563eb`

## Components
Buttons:
- Save, Connection Test, Retry는 primary button을 사용한다.
- Options navigation과 link성 action은 secondary button을 사용한다.
- 비동기 작업 중인 button은 disable한다.
- button label은 popup width 안에서 잘리지 않아야 한다.

Inputs:
- 모든 input에는 위쪽 label을 둔다.
- validation message는 관련 field 근처에 표시한다.
- PAT input은 show/hide toggle을 지원한다.

Toggles:
- Auto Sync는 명확한 on/off switch 또는 checkbox를 사용한다.
- 상태 text는 control 옆에 표시한다.

Links:
- Commit link와 file link는 새 tab에서 연다.
- Sync 성공 후 link를 자동으로 열지 않는다.

## Text Guidelines
- 직접적이고 운영적인 문구를 사용한다.
- 과장된 축하 문구보다 `Synced to GitHub`를 선호한다.
- 모호한 setup 메시지보다 `GitHub connection required`처럼 원인을 드러낸다.
- Error message는 가능한 경우 사용자가 할 수 있는 다음 조치를 포함한다.
- Toast text에는 구현 세부사항을 길게 설명하지 않는다.

## Accessibility
- 모든 form control에는 보이는 label이 있어야 한다.
- Button과 link는 keyboard로 접근 가능해야 한다.
- 상태를 색상만으로 전달하지 않는다.
- Success와 error text는 읽을 수 있는 contrast를 가져야 한다.
- Popup content는 일반적인 extension popup width에서 horizontal scroll 없이 보여야 한다.

## 금지 패턴
사용하지 않는다.
- Marketing hero section.
- Gradient text.
- Decorative background gradient.
- Glassmorphism blur panel.
- Animated glow effect.
- Card 안에 또 큰 card를 넣는 구조.
- Sync마다 GitHub tab을 자동으로 여는 동작.
- Auto Sync off 상태에서 일반 수동 sync button을 제공하는 동작.
- Toast에 긴 technical stack trace를 표시하는 방식.
