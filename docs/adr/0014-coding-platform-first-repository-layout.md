# Sync Repository는 Coding Platform 기준 폴더를 우선한다

결정: Sync Repository의 풀이 구조는 `leetcode`, `programmers` 같은 Coding Platform 폴더를 먼저 두고, 각 Coding Platform 내부를 `swift`, `python` 같은 언어 폴더로 나눈다. v1 자동 sync는 LeetCode와 Programmers Coding Platform 폴더를 모두 갱신할 수 있다.
이유: 사용자의 문제 풀이 저장소는 Coding Platform별 진행 현황과 README를 따로 보는 편이 자연스럽다. Swift 풀이도 Xcode build source folder와 분리해야 하므로 Coding Platform 기준 루트 폴더가 더 안전하다.
트레이드오프: 기존 언어 기준 path로 생성된 파일은 자동 migration하지 않는다. 이후 sync부터 새 Coding Platform 기준 path를 사용한다.
