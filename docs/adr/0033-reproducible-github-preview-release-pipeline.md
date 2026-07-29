# 재현 가능한 GitHub Preview release pipeline

상태: Accepted.

결정: Public Preview는 Chrome Web Store 대신 tag 기반 GitHub Actions에서 build한다. Node/npm과 production dependency를 고정하고, 정렬된 file order와 고정 ZIP metadata를 사용한다. Release는 checksum과 provenance attestation이 포함된 draft prerelease로 생성한다.

이유: Unpacked extension은 GitHub token과 solution code를 처리하므로 사용자가 받은 ZIP을 source version과 연결하고 maintainer local machine에 대한 의존을 줄여야 한다.

트레이드오프: Release 전에 Actions Variables, tag/package/manifest version 일치와 CI audit가 모두 필요하다. Chrome Web Store 자동 업데이트와 심사는 여전히 후속 범위다.
