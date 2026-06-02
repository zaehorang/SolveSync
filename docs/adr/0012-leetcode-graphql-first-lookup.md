# LeetCode 조회는 GraphQL 우선으로 격리한다

결정: v1은 LeetCode problem metadata와 Accepted submission detail을 GraphQL 우선 client로 조회한다.
이유: DOM은 사용자가 본 Accepted 이벤트를 감지하는 데만 안정적이다. 실제 code, language, submission id, metadata는 API response를 기준으로 확정해야 한다.
트레이드오프: LeetCode 내부 API shape가 바뀔 수 있으므로 GraphQL query와 response parsing을 client 모듈에 격리해야 한다.
