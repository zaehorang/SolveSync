# 최소 host permission만 요청한다

결정: v1 manifest는 `storage`, `https://leetcode.com/*`, `https://school.programmers.co.kr/*`, `https://api.github.com/*`, LeetCode/Programmers 문제 페이지 content script match로 제한한다.
이유: 개인용 local extension이라도 PAT와 solution code를 다루므로 권한 범위를 좁게 유지해야 한다.
트레이드오프: 다른 LeetCode domain, Programmers domain, 다른 Coding Platform은 v1에서 동작하지 않는다.
