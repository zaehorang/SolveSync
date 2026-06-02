# README는 v1에서 항상 갱신한다

결정: v1은 solution file, Solution Catalog, Solution README를 항상 같은 GitHub commit에 포함한다. README 갱신을 끄는 UI나 설정은 제공하지 않는다.
이유: README가 Solution Catalog의 projection이라는 규칙을 단순하게 유지해야 sync 결과를 예측하기 쉽다. Toggle을 두면 README와 catalog가 의도적으로 불일치하는 상태가 생긴다.
트레이드오프: 사용자는 v1에서 README 자동 갱신을 끌 수 없다. README marker 밖 내용 보존으로 사용자의 수동 작성 영역을 보호한다.
