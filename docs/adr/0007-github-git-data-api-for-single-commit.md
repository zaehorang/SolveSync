# 단일 commit을 위해 GitHub Git Data API 사용

결정: GitHub Contents API 대신 Git Data API를 사용한다.
이유: Git Data API는 solution code, README, Solution Catalog를 한 commit으로 묶을 수 있다. Accepted 제출 하나와 GitHub commit history 항목 및 Sync History 항목이 대응되어 추적이 깔끔하다.
트레이드오프: ref, tree, blob, commit, branch update conflict를 직접 다뤄야 하므로 구현이 더 복잡하다.
