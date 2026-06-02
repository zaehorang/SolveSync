# Deferred Work

> **Description**: 지금 결정했지만 즉시 반영하지 않고 나중에 처리할 작업을 추적하는 문서다.

## Domain naming compatibility cleanup

Domain naming migration은 문서, TypeScript identifier, runtime message, storage schema, UI copy에 반영되었다. 남은 항목은 새 기능이나 naming 재설계가 아니라 compatibility 유지 범위다.

- Solution Catalog 실제 파일 경로는 호환성을 위해 `leetcode/.leetcode-sync/index.json`과 `programmers/.programmers-sync/index.json`으로 유지한다. 파일명 변경은 기존 Sync Repository link와 사용자의 저장소 구조를 깨뜨릴 수 있으므로, 필요하면 별도 ADR과 migration 계획으로 다룬다.
- 기존 `chrome.storage.local`, runtime message alias, Solution Catalog v1 input을 읽는 compatibility parser는 유지한다. 설치된 local profile과 기존 Sync Repository catalog file을 계속 읽어야 하므로, 제거는 migration 안정화 이후 별도 compatibility cleanup으로만 검토한다.
