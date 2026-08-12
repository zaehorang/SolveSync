# 중앙 language registry와 단일 README Languages column 사용

상태: Accepted.

결정: Supported language는 Swift, Python3, Java, C++, JavaScript, TypeScript, Kotlin, Go, Rust다. 각 언어의 stable key, display name, LeetCode/Programmers alias, folder, extension을 `src/shared/languageRegistry.ts` 한 곳에서 관리한다.

Coding Platform이 실제로 노출하는 alias만 normalize한다. 알 수 없는 언어는 기존 `unsupported_language` 흐름으로 처리하고 commit하지 않는다. Path policy, type guard, Solution Catalog, README renderer는 registry key를 공유한다.

Solution Catalog schema는 v4로 올린다. v1-v3 catalog는 읽을 때 v4로 normalize한다.
Solution README는 언어마다 별도 column을 늘리지 않는다. LeetCode는 `#`, `Title`,
`Difficulty`, `Solved`, `Languages`를 사용하고, 신뢰할 수 있는 Difficulty source가 없는
Programmers는 `#`, `Title`, `Solved`, `Languages`를 사용한다. Programmers Catalog의
`difficulty: "-"`는 schema 호환성을 위해 유지한다. `Languages` cell은 존재하는 solution
link를 registry 순서로 표시한다.

이유: 언어 추가 시 mapping, extension, path, README를 여러 모듈에서 따로 수정하면 drift가 생긴다. 단일 registry는 pure logic 테스트가 가능한 계약을 만들고, 단일 Languages column은 앞으로 언어가 추가되어도 README 폭과 schema를 안정적으로 유지한다.

트레이드오프: Coding Platform이 label을 변경하면 alias registry와 테스트를 갱신해야 한다. 일부 Programmers 문제는 지원 목록의 모든 언어를 제공하지 않으므로 수동 검증은 해당 문제 UI에서 실제로 제공되는 언어만 대상으로 한다.

Swift 예외: Swift solution은 계속 Coding Platform별 `swift` 폴더에 저장하며 Xcode build source folder 아래에 만들지 않는다.
