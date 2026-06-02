# Swift solution은 Xcode build folder 밖에 저장

결정: Sync Repository에서 Swift 풀이는 Coding Platform별 풀이 폴더인 `leetcode/swift` 또는 `programmers/swift`에 저장한다.
이유: 검증용 저장소의 `swift/SwiftAlgorithm`은 Xcode build target에 동기화된다. 온라인 저지 풀이 파일은 흔히 `Solution` 함수/class와 Coding Platform별 helper type을 정의하므로 한 모듈로 컴파일되면 충돌할 수 있다.
트레이드오프: Swift 풀이는 Xcode project source folder 내부가 아니라 Coding Platform 기준 풀이 폴더에 저장된다.
