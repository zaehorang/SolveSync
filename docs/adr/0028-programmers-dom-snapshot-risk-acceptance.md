# Programmers DOM Snapshot Risk Acceptance

결정: v1은 Programmers Accepted 제출을 동기화할 때 현재 페이지 DOM의 Accepted Editor Snapshot을 solution source로 계속 사용한다. 별도 사용자 confirmation gate, 일반 수동 sync, Programmers 비공식 제출 상세 API 의존은 추가하지 않는다.

이유: Programmers는 LeetCode처럼 안정적으로 사용할 공식 Accepted submission detail API를 전제로 하기 어렵다. SolveSync v1의 목표는 local unpacked extension에서 사용자가 푼 Swift/Python3 solution source를 개인 GitHub 저장소에 자동 반영하는 것이다. 이 데이터는 PAT, cookie, session token, repository 선택 정보가 아니라 사용자가 제출한 solution code다.

보안 경계: Programmers page DOM과 script는 extension background보다 낮은 trust boundary에 있다. 따라서 Programmers origin DOM/script가 compromise되면 committed solution source integrity가 영향을 받을 수 있다. 이 residual risk는 v1에서 문서화하고 수용한다.

필수 control: content message에는 PAT, LeetCode/Programmers cookie, session token을 포함하지 않는다. GitHub API 호출은 background service worker에서만 수행한다. GitHub write 대상은 Options에서 사용자가 선택한 Sync Repository와 Sync Branch로 제한한다. Empty code, missing lesson/title/language, unsupported language는 기존처럼 commit하지 않는다. Processed Sync Deduplication Key는 GitHub commit 성공 후에만 기록한다.

거절한 대안: confirmation gate는 v1의 자동 sync 흐름과 일반 수동 sync 금지 정책을 약화한다. Programmers 비공식 API 의존은 유지보수성과 안정성 면에서 v1 제외 사항이다. Programmers Auto Sync 비활성화는 v1 핵심 사용 흐름을 지나치게 줄인다.
