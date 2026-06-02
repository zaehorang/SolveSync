# Coding Platform adapter와 shared sync core를 분리한다

결정: Accepted 감지, metadata/source 수집, 사이트별 parsing은 Coding Platform adapter에 둔다. GitHub commit, storage, retry, Sync History, README/catalog merge는 shared sync core에서 처리한다.
이유: LeetCode와 Programmers는 code source가 다르지만 GitHub에 commit하고 상태를 복구하는 제품 로직은 같다. 공통 core와 Coding Platform adapter를 분리하면 중복을 줄이면서 사이트 변경 영향 범위를 좁힐 수 있다.
트레이드오프: `codingPlatform` 필드와 Coding Platform policy layer가 추가되어 타입과 migration 작업이 늘어난다. 대신 새 Coding Platform 추가 시 GitHub, storage, retry 로직을 다시 만들지 않아도 된다.
