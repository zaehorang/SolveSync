# v1은 OAuth 대신 fine-grained PAT 사용

결정: v1에서는 사용자가 입력한 fine-grained GitHub PAT를 사용한다.
이유: PAT 방식은 v1을 local extension으로 빠르게 검증할 수 있게 한다. OAuth app 등록, callback 처리, 배포 준비가 필요 없다.
트레이드오프: `chrome.storage.local`의 PAT 저장은 OS keychain 수준의 보안이 아니다. UI와 문서에서 이 한계와 최소 권한 token 사용을 명확히 안내해야 한다.
