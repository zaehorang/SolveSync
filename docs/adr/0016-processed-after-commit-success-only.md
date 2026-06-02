# processed marking은 commit 성공 후에만 한다

결정: processed Sync Deduplication Key에는 GitHub commit 성공 후에만 Sync Deduplication Key를 기록한다. GitHub commit 실패는 Retry Bundle과 Sync History에만 남긴다.
이유: commit이 실패한 제출을 processed로 표시하면 이후 재시도나 재감지가 어려워진다. 성공 기준을 GitHub commit 완료로 두면 사용자의 저장소 상태와 extension 상태가 맞는다.
트레이드오프: 실패한 제출이 다시 감지될 수 있으므로 Sync Deduplication Key별 in-flight lock과 Retry Bundle 관리가 필요하다. In-flight lock은 service worker 중단에 대비해 10분 TTL을 둔다.
