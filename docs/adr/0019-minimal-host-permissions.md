# 최소 host permission만 요청한다

결정: v1 manifest는 `storage`, `https://leetcode.com/*`, `https://school.programmers.co.kr/*`, `https://swexpertacademy.com/*`, `https://github.com/*`, `https://api.github.com/*`, 지원 Coding Platform 문제 페이지 content script match로 제한한다. SWEA 풀이 페이지에는 같은 match의 MAIN world bridge를 추가로 주입한다([ADR 0035](0035-main-world-editor-bridge-for-swea.md)).
이유: 개인용 local extension이라도 GitHub session token과 solution code를 다루므로 권한 범위를 좁게 유지해야 한다. Device Flow 도입으로 `https://github.com/*`는 token endpoint와 사용자가 명시적으로 여는 설치/verification page에 필요하다.
트레이드오프: 지원 Coding Platform의 다른 domain과 목록 밖 Coding Platform은 동작하지 않는다. 지원 플랫폼을 추가할 때마다 host permission이 늘어나므로 기존 설치본에는 권한 재승인이 필요하다.
