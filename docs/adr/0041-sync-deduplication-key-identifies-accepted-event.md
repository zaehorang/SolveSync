# Sync Deduplication Key는 code가 아니라 Accepted 이벤트를 식별한다

상태: Accepted.

결정: Sync Deduplication Key의 `acceptedSourceId`에서 code hash를 뺀다. 공식 Accepted Source ID가 없는 Coding Platform은 `{codingPlatform}:{problemId}:{language}:{detectedAtMs}` 형식을 쓴다. `detectedAtMs`는 adapter가 fresh Accepted transition을 확정한 시점의 epoch millisecond이며, 그 시각은 [ADR 0034](0034-fresh-accepted-transition-and-immutable-event.md)가 정한 대로 signal 시점에 한 번 캡처된 뒤 변하지 않는다.

그래서 같은 code를 다시 제출해도 Accepted마다 다른 key가 나오고, 매번 commit이 생긴다. Solution Revision Number도 매번 증가한다. Sync Deduplication Key가 계속 막는 것은 **하나의 Accepted 이벤트가 두 번 처리되는 것**뿐이다.

processed Sync Deduplication Key 보관함에는 7일 TTL과 100개 상한을 둔다.

이유: "같은 code면 commit하지 않는다"는 결정된 정책이 아니라 식별자 재료에서 딸려온 부작용이었다. LeetCode는 플랫폼이 제출마다 고유 ID를 주므로 재제출이 그대로 commit이 됐고, 공식 ID가 없는 Programmers와 SWEA만 code hash로 그 자리를 메우다가 다른 동작을 하게 됐다. 사용자에게는 같은 문제를 다시 푼 기록이 남는 편이 맞고, 플랫폼마다 다를 이유는 더더욱 없다.

보관함 상한이 함께 필요한 이유는 key의 증가 속도가 바뀌기 때문이다. code hash 시절에는 항목이 "문제 x 언어" 수만큼만 늘었지만, 이제는 Accepted마다 하나씩 는다. 이 보관함은 원래 무한히 누적되고 있었고 그 상태로는 `chrome.storage.local`이 계속 커진다. TTL을 7일로 잡은 것은 Retry Bundle의 보관 기한과 같기 때문이다. 실패한 commit은 최대 7일 뒤까지 재시도될 수 있고, 그때 "이미 성공했는가"를 판단하는 것이 이 보관함이다. 더 짧으면 그 판단이 비어버린다.

트레이드오프: 오탐지한 Accepted가 그대로 commit이 된다. code hash 시절에는 같은 code를 다시 읽은 오탐지가 우연히 걸러졌다. 그 방어는 LeetCode에는 원래 없었고([`docs/investigations/LEETCODE_SOLVED_BADGE_FALSE_ACCEPTED.md`](../investigations/LEETCODE_SOLVED_BADGE_FALSE_ACCEPTED.md)), 이제 세 플랫폼 모두 없다. 오탐지는 감지 계층에서 막을 문제이지 식별자 우연에 기대 막을 문제가 아니다.

`acceptedSourceId` 형식 변경은 그 자체로 migration이다. 기존 사용자의 processed 항목은 새 key와 절대 매치되지 않으므로, 업데이트 후 첫 Accepted는 이전에 동기화한 것과 같은 code여도 한 번 commit된다. Solution File 내용이 같아도 Solution Catalog의 revision과 날짜가 바뀌므로 빈 commit은 아니다.

보관함 상한을 넘긴 항목은 버려지므로, 100개 전의 Accepted 이벤트가 다시 전달되면 중복 commit을 막지 못한다. 같은 이벤트의 재전달은 억제 창과 in-flight lock이 초 단위에서 막고, 그 뒤 100번의 Accepted를 지나 되살아나는 경로는 없다.
