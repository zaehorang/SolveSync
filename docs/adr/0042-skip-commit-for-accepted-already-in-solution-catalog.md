# Solution Catalog에 이미 있는 Accepted는 commit하지 않는다

상태: Accepted.

결정: commit 직전에 Sync Branch에서 읽은 Solution Catalog의 이 문제·언어 `lastAcceptedSourceId`가 이번 `acceptedSourceId`와 같으면 commit하지 않는다. 대신 그 Accepted가 이미 반영된 것으로 보고 sync를 성공으로 끝낸다. processed Sync Deduplication Key를 기록하고, 같은 key의 Retry Bundle이 있으면 재시도 경로와 일반 경로 모두 storage에서 key로 찾아 전부 지우고, Sync History에 `synced` 항목을 남긴다. 두 경로 모두 commit을 만든 성공에서도 같은 key의 남은 Retry Bundle을 지운다.

이 확인은 Catalog를 읽는 세 자리에 모두 적용한다.

- 일반 경로(`content:accepted_detected`)가 처음 읽은 Catalog
- Retry Bundle 재시도가 처음 읽은 Catalog
- ref update가 conflict로 끝나 최신 branch에서 다시 읽은 Catalog. 이때 `onConflict`는 payload 대신 `null`을 돌려주고, GitHub client는 blob·tree·commit을 만들지 않고 `commitSha: null`인 결과를 돌려준다.

Retry Bundle 재시도는 Sync Deduplication Key lock을 얻은 직후 processed를 한 번 더 확인한다. 일반 경로는 원래 그렇게 하고 있었다. 처음 확인과 lock 획득 사이에 같은 key의 처리가 끝나 lock이 풀릴 수 있기 때문이다. 이미 processed면 lock을 풀고 같은 key의 Retry Bundle을 모두 지운 뒤 `duplicate_processed`를 돌려준다.

이유: [ADR 0041](0041-sync-deduplication-key-identifies-accepted-event.md)은 같은 `acceptedSourceId`에서 Catalog가 revision 번호와 날짜를 다시 쓰지 않게 했을 뿐, commit은 막지 못한다고 적었다. commit은 성공했는데 processed 기록이 남지 않으면(service worker 종료, 응답 유실) Retry Bundle 재시도가 같은 Accepted를 같은 `(rev n)` 제목으로 한 번 더 commit했다. LeetCode는 제출마다 고정된 submission ID를 쓰므로, processed 기록이 7일 TTL이나 100개 상한으로 지워진 뒤 같은 제출이 다시 감지되어도 일반 경로가 다시 commit했다.

processed 보관함은 기기 안의 기록이라 사라질 수 있다. 같은 Accepted가 이미 Sync Branch에 있다는 사실은 Sync Branch의 Catalog가 가장 확실하게 알고, commit 직전에는 어차피 그 Catalog를 읽는다. 그래서 추가 조회 없이 마지막 방어선을 둘 수 있다.

## processed 기록에 남기는 commit sha

processed 항목은 `commitSha: string`을 요구한다. commit을 건너뛰었으면 **이 Accepted를 담고 있다고 확인한 Sync Branch head sha**를 남긴다. 처음 읽은 Catalog에서 확인했으면 branch ref를 한 번 더 읽고(`readBranchHead`), conflict 뒤에 확인했으면 이미 다시 읽은 head를 쓴다.

그 Accepted를 처음 쓴 commit은 아니다. 그 commit을 찾으려면 commit history를 거슬러 올라가야 하는데, 지금 이 값을 읽는 코드가 없다. head는 그 Accepted를 포함하는 commit이라 뜻이 틀리지 않고, storage schema를 바꾸지 않아도 된다. `string | null`로 바꾸는 방법도 있었지만 schema 검증이 바뀐다. 이전 버전은 `null` 항목 하나 때문에 processed 보관함 전체를 malformed로 보고 비운다.

## [ADR 0016](0016-processed-after-commit-success-only.md)에서 달라지는 것

0016은 processed를 "GitHub commit 성공 후에만" 기록한다고 정했다. 그 결정이 지키려던 것은 **processed이면 그 Accepted가 Sync Branch에 있다**는 불변식이다. 이번 결정은 이 extension이 commit하지 않았어도 Sync Branch의 Catalog가 그 사실을 보여 주면 processed를 기록한다. 불변식은 그대로 지켜지고, 기록하는 근거가 "방금 만든 commit"과 "Catalog가 보여 준 반영" 두 가지로 늘어난다. commit 단계 실패를 processed로 기록하지 않는 규칙은 그대로다.

## 사용자에게 보이는 것

새 status를 만들지 않고 `synced`를 쓴다. Accepted가 Sync Branch에 있다는 점에서 사실과 맞고, 문구("GitHub에 동기화됨")도 commit을 만들었다고 말하지 않는다. 새 status를 만들면 `SyncStatus` union, storage의 Sync History 검증, i18n 문구와 UI_GUIDE를 함께 바꿔야 하는데, 사용자가 다르게 행동할 이유가 없다.

Sync History 항목의 `commitSha`, `commitUrl`, `fileUrl`은 `null`이다. head commit은 이 Accepted와 무관한 commit일 수 있어 commit link로 쓰지 않는다. 그래서 toast와 Popup에는 Commit·File link가 없다. 다른 두 방어선(processed 확인, in-flight lock)과 달리 조용히 끝나지 않는 이유는 이 확인이 `syncing`이나 `retrying` 상태를 이미 알린 뒤에 일어나기 때문이다. 끝 상태를 알리지 않으면 toast가 진행 중 표시로 남는다.

## [ADR 0041](0041-sync-deduplication-key-identifies-accepted-event.md)과 [ADR 0027](0027-solution-revision-numbered-commit-message.md)에서 달라지는 것

0041이 "commit 자체는 다시 만들어지는 한계가 남아 있다"고 적은 두 경로, 곧 Retry Bundle 재시도와 processed 만료 뒤 LeetCode 재감지는 이제 commit을 만들지 않는다. 0027의 "같은 Accepted 재감지는 중복 commit이 아니다"가 이 두 경로에서 다시 성립한다.

0041의 나머지는 그대로다. 억제 창 밖 재감지는 여전히 다른 key를 만들어 새 commit이 된다. Catalog에서 서로 다른 `acceptedSourceId`로 보이기 때문이다.

Catalog merge의 "같은 `acceptedSourceId`면 revision을 세지 않는다" 분기는 남긴다. sync는 이제 그 경우 merge까지 오지 않지만, merge만 떼어 불렀을 때도 이미 반영된 Accepted를 두 번 세지 않게 하려는 것이다.

트레이드오프: **Catalog는 문제·언어마다 마지막 Accepted 하나만 기억한다.** Accepted A가 반영된 뒤 같은 문제·언어의 B가 반영됐다면, A의 Retry Bundle이나 A의 LeetCode 재감지는 A를 알아보지 못해 다시 commit되고 B의 Solution File을 A로 덮는다. 0041이 적은 "낡은 Retry Bundle이 더 새로운 풀이를 덮어쓴다" 한계가 이미 반영된 A에도 그대로 남는다. 막으려면 Catalog에 Accepted 이력을 쌓아야 하는데, v5에서 읽지 않는 activity를 지운 [ADR 0040](0040-drop-unread-activity-from-solution-catalog.md)과 방향이 반대라 여기서 하지 않는다.

Catalog가 틀리면 이 확인도 틀린다. 사용자가 Catalog 파일을 손으로 고쳐 다른 `lastAcceptedSourceId`를 넣으면 commit이 다시 생기고, 반대로 같은 값을 넣으면 실제로 반영되지 않은 Accepted를 건너뛴다. Catalog는 이 extension이 관리하는 파일이므로 이 위험은 받아들인다.

처음 읽은 Catalog에서 건너뛰는 경우 branch ref 조회가 한 번 늘어난다. 건너뛸 때만 일어난다.
