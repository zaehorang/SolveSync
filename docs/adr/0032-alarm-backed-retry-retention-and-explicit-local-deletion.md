# Alarm 기반 Retry 보관과 명시적 local data 삭제

상태: Accepted.

결정: Retry Bundle의 7일 TTL은 lazy access cleanup에만 의존하지 않는다. Service worker boot, install/update, Chrome startup과 하루 주기 `retry-bundle-prune` alarm에서 정리한다. Options는 Retry Data만 삭제하는 action과 pending Device Flow를 포함한 모든 local data를 삭제하는 action을 각각 inline confirmation과 함께 제공한다.

이유: Retry Bundle은 solution code를 포함할 수 있으므로 고지한 보관 기간과 실제 삭제 기회를 일치시켜야 한다. Disconnect GitHub, Retry Data 삭제, 전체 local data 삭제와 GitHub 측 권한 회수는 서로 다른 작업이다.

트레이드오프: `alarms` permission과 lifecycle maintenance가 추가된다. Chrome이 종료된 동안 wall-clock 시점에 즉시 삭제할 수는 없으며 다음 Chrome 또는 extension 활성화 때 정리한다.
