# Solution Catalog v5에서 읽지 않는 activity를 지운다

상태: Accepted.

결정: Solution Catalog schema를 v5로 올리고 `activity` 필드를 제거한다. v1-v4 catalog를 읽을 때 `activity`가 어떤 모양이든 검사하지 않고 버린다. 별도 migration commit은 만들지 않고, 각 Coding Platform의 다음 성공 sync에서 해당 Catalog가 v5로 다시 쓰인다. 사용자에게 풀이 활동 통계를 보여줄 필요가 생기면 그때 `problems`의 first/last accepted date에서 다시 계산한다.

이유: `activity`는 `mergeSolutionCatalogEntry`가 쓰기만 하고 읽는 코드가 없었다. Popup, Options, Solution README 어디에도 노출되지 않는다. 그러면서 문제를 푼 날마다 항목이 하나씩 늘어 Sync Repository의 index.json에 영구히 쌓인다. 보호하는 것이 없는데 파일만 키우고, schema에 남아 있는 한 다음 사람은 이것이 무엇을 위한 필드인지 확인하는 비용을 계속 낸다. 게다가 같은 정보는 `problems`의 accepted date에서 언제든 다시 계산할 수 있으므로 저장할 이유가 없다.

트레이드오프: schema version과 migration 분기가 한 단계 더 늘어난다. 이미 쌓인 date별 count는 버려지므로, 나중에 통계를 만들면 재계산으로 얻는 값과 어긋날 수 있다. accepted count는 같은 날 같은 문제를 여러 번 반영한 횟수까지 세지만 재계산은 문제당 날짜만 알기 때문이다. 이 차이를 지키자고 아무도 읽지 않는 필드를 유지하지는 않는다. 사용자의 Sync Repository에 있는 index.json은 다음 sync 전까지 v4로 남는다. 읽을 때 normalize하므로 동작에는 영향이 없다.
