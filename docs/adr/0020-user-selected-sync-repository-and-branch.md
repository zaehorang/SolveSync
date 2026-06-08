# Sync Repository와 Sync Branch는 사용자가 선택한다

결정: v1은 특정 GitHub repository를 코드 기본값으로 고정하지 않는다. 사용자가 fine-grained PAT를 입력하면 확장은 PAT로 접근 가능한 repository 목록을 보여주고, 사용자가 Sync Repository와 Sync Branch를 선택한다.
이유: 검증 대상은 `your-name/algorithm-solutions` 같은 개인 테스트 repository일 수 있지만, 확장 제품은 다른 repository나 다른 사용자의 GitHub 계정에서도 동작해야 한다. 설정 가능한 owner/repo 입력보다 picker를 제공하면 selected repository 권한과 실제 접근 가능 상태를 사용자가 더 명확히 확인할 수 있다.
트레이드오프: Options 구현에 repository list, branch list, empty list, pagination, branch create 실패 처리가 추가된다.
