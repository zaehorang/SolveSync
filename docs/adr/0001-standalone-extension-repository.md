# Standalone extension 저장소

결정: SolveSync를 standalone Chrome extension 프로젝트로 유지하고 source code는 루트의 `src/` 아래에 둔다.
이유: 이 확장은 특정 알고리즘 저장소 내부 도구가 아니라 독립 제품이다. Sync Repository는 설정값으로 다뤄야 한다.
트레이드오프: 확장은 local file path가 아니라 원격 Sync Repository의 path 규칙을 기준으로 동작해야 한다.
