# Branch 생성은 명시적 사용자 action으로만 수행한다

결정: 선택한 Sync Repository에 원하는 Sync Branch가 없으면 확장이 자동으로 생성하지 않는다. Options의 Create branch action을 사용자가 명시적으로 실행한 경우에만 repository default branch HEAD에서 새 branch ref를 생성한다.
이유: Sync Branch 이름 오타로 불필요한 branch가 생기는 것을 막고, GitHub write 동작을 사용자의 명확한 의사와 연결하기 위해서다.
트레이드오프: 첫 설정 때 Sync Branch가 없으면 사용자가 한 번 더 action을 실행해야 한다. Empty repository나 default branch 조회 실패 같은 branch 생성 불가 상태를 UI에서 설명해야 한다.
