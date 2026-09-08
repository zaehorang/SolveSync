# Sync Deduplication Key는 code가 아니라 Accepted Signal을 식별한다

상태: Accepted.

결정: Sync Deduplication Key의 `acceptedSourceId`에서 code hash를 뺀다. 공식 Accepted Source ID가 없는 Coding Platform은 `{codingPlatform}:{problemId}:{language}:{detectedAtMs}` 형식을 쓴다. `detectedAtMs`는 adapter가 fresh Accepted transition을 확정한 시점의 epoch millisecond, 즉 [Accepted Signal](../../CONTEXT.md) 하나를 가리키는 값이다. 그 시각은 signal 시점에 한 번 캡처된 뒤 변하지 않는다([ADR 0034](0034-fresh-accepted-transition-and-immutable-event.md)). 읽을 수 없거나 시각으로 파싱되지 않으면 대체값을 만들지 않고 플랫폼별 extract failure로 떨어뜨린다.

그래서 같은 code를 다시 제출해도 Accepted마다 다른 key가 나오고, 매번 commit이 생긴다. Solution Revision Number도 매번 증가한다.

processed Sync Deduplication Key 보관함에는 7일 TTL과 100개 상한을 둔다. 방금 기록한 항목은 상한과 기한에 상관없이 남긴다.

Solution Catalog의 "같은 `acceptedSourceId`면 revision을 세지 않는다" 분기는 **유지한다.** 의미가 "같은 code"에서 "이미 Sync Branch에 써진 Accepted"로 바뀌었을 뿐이고, 그 조건이 참이 되는 경로가 아직 있다 — commit은 성공했는데 processed 기록이 남지 않아(service worker 종료, 응답 유실) Retry Bundle로 다시 올라오는 경우다.

이유: "같은 code면 commit하지 않는다"는 결정된 정책이 아니라 식별자 재료에서 딸려온 부작용이었다. LeetCode는 플랫폼이 제출마다 고유 ID를 주므로 재제출이 그대로 commit이 됐고, 공식 ID가 없는 Programmers와 SWEA만 code hash로 그 자리를 메우다가 다른 동작을 하게 됐다. 사용자에게는 같은 문제를 다시 푼 기록이 남는 편이 맞고, 플랫폼마다 다를 이유는 더더욱 없다.

식별자 재료로 난수 event id 대신 감지 시각을 고른 이유는 새 message field 없이 이미 있는 불변값을 쓰기 때문이다. 두 값의 성질은 같다. 난수 id도 signal 시점에 한 번 만들어 event에 실리면 같은 보장을 준다.

## ADR 0027에서 달라지는 것

[ADR 0027](0027-solution-revision-numbered-commit-message.md)의 트레이드오프는 "같은 Accepted 재감지는 중복 commit이 아니므로 번호가 증가하지 않으며"라고 적었다. **그 문장의 보호 범위가 좁아진다.**

- 같은 Accepted가 억제 창(`ACCEPTED_COALESCING_WINDOW_MS`) 밖에서 두 번 감지되면 Programmers와 SWEA에서는 서로 다른 Signal로 취급되어 번호를 두 번 소비한다. 이전에는 code hash가 같아 흡수됐다.
- 이미 Sync Branch에 반영된 Accepted가 Retry Bundle로 다시 올라오는 경우는 위 결정대로 계속 번호를 소비하지 않는다.

0027의 나머지는 그대로다. 번호는 여전히 Sync Branch에 실제 반영된 revision을 뜻하고, commit 실패와 Retry Bundle 생성은 번호를 소비하지 않는다. 달라진 것은 **무엇을 "다시 반영"으로 보는가**이며, 같은 code를 다시 제출하는 것은 이제 반영이다.

## LeetCode는 이 불변식의 예외다

LeetCode의 `acceptedSourceId`는 플랫폼이 준 submission ID라 Signal이 아니라 **제출 레코드**를 식별한다. Background가 조회한 제출이 방금 그 제출이라는 보장은 없고, 목록 반영이 늦으면 직전 Accepted가 올라온다([LEETCODE.md](../platforms/LEETCODE.md)). 그때는 새 Accepted가 이전 submission ID로 해석되어 processed에 걸리고 commit이 생기지 않는다.

이 성질은 이번 결정이 만든 것이 아니라 원래 있던 것이고, 여기서 바꾸지 않는다. "Accepted마다 commit이 생긴다"를 세 플랫폼 공통으로 말할 때 LeetCode에는 이 예외가 붙는다.

트레이드오프: **억제 창 밖에서 같은 Accepted가 다시 감지되면 이제 아무 층도 막지 못한다.** 중복 방지는 억제 창(700ms) · in-flight lock · processed 보관함 세 층인데, 뒤의 두 층은 key가 같을 때만 동작한다. Programmers와 SWEA에서 재감지는 이제 다른 key를 만든다. 이전에는 code hash가 그 경우를 전부 흡수했다. 재감지를 막는 책임은 감지 계층으로 넘어간다. [미재현 investigation](../investigations/PROGRAMMERS_ACCEPTED_SYNC_MISS_AFTER_SPA_RETURN.md)이 제안하는 startup baseline 변경은 이 조건에서 다시 검토해야 한다.

오탐지한 Accepted도 그대로 commit이 된다. code hash 시절에는 같은 code를 다시 읽은 오탐지가 우연히 걸러졌다. LeetCode에서는 submission ID가 같아 processed 보관함이 그 방어를 하고 있었고([LEETCODE_SOLVED_BADGE_FALSE_ACCEPTED.md](../investigations/LEETCODE_SOLVED_BADGE_FALSE_ACCEPTED.md)), **이번 결정의 TTL과 상한이 그 방어에 기한을 붙인다.** 7일이 지나거나 그 사이 100개를 넘겨 밀려나면 같은 submission ID로 다시 commit될 수 있다. 그 investigation의 "피해가 제한되는 이유"는 이 기한 안에서만 성립한다.

낡은 Retry Bundle의 재시도가 더 새로운 풀이를 덮어쓸 수 있다. 실패한 commit은 최대 7일 뒤까지 재시도되는데, 그 사이 사용자가 같은 문제를 다시 풀어 동기화했다면 key가 달라 그대로 commit되고 옛 code가 Solution File을 덮는다. 이전에는 code가 같은 한 막혔다.

TTL 7일과 상한 100개는 서로 다른 것을 보호한다. 상한은 저장 크기를, TTL은 "같은 Accepted가 얼마나 오래 뒤에 다시 와도 막을 것인가"를 정한다. Programmers와 SWEA에서 그 답은 초 단위다 — 감지 시각이 재현되지 않으므로 오래된 항목은 아무것도 막지 못한다. **실질적으로 이 기한은 LeetCode의 오탐지 방어 수명이다.** 7일로 잡은 것은 Retry Bundle의 보관 기한과 같은 값을 써서 두 보관함의 수명이 어긋나지 않게 하려는 것이고, 상한과 기한 중 어느 쪽이 먼저 걸릴지는 사용자의 풀이 속도에 달렸다. 일주일에 100문제를 넘기면 상한이 지배한다.

`acceptedSourceId` 형식 변경은 그 자체로 migration이다. 기존 사용자의 processed 항목은 새 key와 절대 매치되지 않으므로, 업데이트 후 첫 Accepted는 이전에 동기화한 것과 같은 code여도 한 번 commit된다. Solution File 내용이 같아도 Solution Catalog의 revision과 날짜가 바뀌므로 빈 commit은 아니다. 낡은 항목은 형식이 다를 뿐 TTL이 지나면 사라지므로 별도 migration 코드를 두지 않는다.

`STORAGE_SCHEMA_VERSION`은 올리지 않는다. 저장 **형태**는 그대로이고 값의 문법만 바뀌었기 때문이며([ADR 0017](0017-versioned-storage-schema.md)의 대상은 형태다), 이 버전은 `settings`와 `githubAuth`를 포함한 모든 key가 공유하는 단일 숫자라 올리면 무관한 key까지 다시 쓰게 된다.
