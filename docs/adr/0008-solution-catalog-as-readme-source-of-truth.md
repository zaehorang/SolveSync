# Solution Catalog를 README source of truth로 사용

결정: Coding Platform별 sync metadata는 각 Solution Catalog에 저장하고 Solution README는 해당 catalog에서 생성한다. LeetCode는 `leetcode/.leetcode-sync/index.json`, Programmers는 `programmers/.programmers-sync/index.json`을 사용한다.
이유: README table을 상태로 파싱하는 방식은 깨지기 쉽다. 구조화된 catalog를 두면 README 생성이 결정적이고 복구 가능하다.
트레이드오프: Sync Repository의 각 Coding Platform 폴더 안에 추가 metadata file이 생긴다.
