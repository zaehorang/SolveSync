# Trusted storage와 sender-scoped runtime ingress

상태: Accepted.

결정: `chrome.storage.local`은 background 시작 시 `TRUSTED_CONTEXTS`로 제한한다. Runtime ingress는 typed payload validation뿐 아니라 현재 extension ID, 실제 sender URL과 surface별 message allowlist를 검사한다. Content에는 전체 settings 대신 locale preference 같은 최소 DTO만 반환한다.

이유: GitHub token과 Retry Bundle solution code는 page content가 직접 읽을 필요가 없다. MV3의 여러 extension surface를 type union만으로 신뢰하면 향후 bridge나 surface 변경이 privileged background action 범위를 넓힐 수 있다.

트레이드오프: Background handler는 storage access-level 초기화를 기다려야 하고 surface마다 message 계약과 sender fixture를 유지해야 한다.
