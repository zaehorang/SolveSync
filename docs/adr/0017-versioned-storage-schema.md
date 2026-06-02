# Storage schema는 version을 포함한다

결정: `settings`, `processedSyncDeduplicationKeys`, `syncHistory`, `retryBundles`, `inFlightSyncDeduplicationKeys`는 모두 version field를 가진 top-level object로 저장한다.
이유: v1은 local extension이지만 storage 구조는 릴리즈 후 바꾸기 어렵다. version을 두면 이후 migration을 명시적으로 처리할 수 있다.
트레이드오프: 단순 array나 primitive value를 바로 저장하는 것보다 boilerplate가 늘어난다.
