# Authoring

문서와 컨텍스트를 추가하거나 바꿀 때 어디에 무엇을 쓰는지 정한다. 각 문서 종류의 세부 형식은 그 폴더의 README가 정본이고, 여기는 **어느 폴더로 가야 하는지**와 폴더 README에 없는 공통 규칙만 담는다.

## 어디에 쓰나

| 남기려는 것 | 자리 | 형식의 정본 |
|---|---|---|
| 설계 결정과 tradeoff | `docs/adr/NNNN-slug.md` | [`docs/adr/README.md`](../docs/adr/README.md), [TEMPLATE](../docs/adr/TEMPLATE.md) |
| 플랫폼 DOM 사실, selector, 식별자 형식 (구현 계약) | `docs/platforms/<PLATFORM>.md` | [`docs/platforms/README.md`](../docs/platforms/README.md) |
| 사용자가 보는 동작, 손으로 검수할 항목 | `docs/specs/<platform>/*.md` | [`docs/specs/README.md`](../docs/specs/README.md) |
| 코드 폴더의 소유 책임, 대표 변경 절차, 비직관적 규칙 | `docs/modules/<folder>.md` | [`docs/modules/README.md`](../docs/modules/README.md) |
| 도메인 용어 | `CONTEXT.md` | 같은 파일의 기존 항목 형식 |
| 미재현 증상과 원인 가설 | `docs/investigations/*.md` | [`docs/investigations/ABOUT.md`](../docs/investigations/ABOUT.md) |
| 지금 고치지 않을 일, 합의가 더 필요한 결정 | GitHub Issue | [`.github/ISSUE_TEMPLATE/`](../.github/ISSUE_TEMPLATE) |
| 조사 결과, 착수 근거, 검증 방법 | PR body | [`.github/PULL_REQUEST_TEMPLATE.md`](../.github/PULL_REQUEST_TEMPLATE.md) |
| 진행 중 작업의 실행 계획, 개인 메모 | `.local/` | 없음. 추적하지 않는다 |
| 작업 절차 자체 | `workflow/*.md` | 이 폴더 |

## ADR
- 다음 번호는 `docs/adr/README.md` 맨 위에 있다. 번호는 재사용하지 않는다. 재사용하면 과거 commit, PR, 코드 주석의 참조가 다른 문서를 가리킨다.
- 모든 ADR은 제목 다음에 `상태:` 줄을 갖는다. 결정이 바뀌면 기존 ADR을 고치지 않고 새 ADR을 쓴 뒤 옛 것의 상태를 `Superseded by NNNN`으로 바꾼다.
- 새 ADR을 쓰면 README 목록과 다음 번호를 같은 commit에서 갱신한다.
- 트레이드오프가 없으면 결정이 아니라 관례다. ADR로 쓰지 않는다.

## platforms와 specs
- 같은 플랫폼 동작은 두 문서에 독자가 다르게 적힌다. `platforms/`는 adapter를 고칠 사람에게 DOM 사실을, `specs/`는 그 기술을 모르는 사람에게 관측 가능한 동작을 쓴다. 한쪽을 바꾸면 다른 쪽이 어긋나지 않는지 확인한다.
- 둘이 어긋나면 구현이 무엇을 하는지는 `platforms/`가 맞고, 그것이 옳은 동작인지는 `specs/`의 열린 질문으로 올린다.
- 플랫폼 문서는 공통(`platforms/README.md`)과 다른 것만 적는다. 같은 문장을 세 번 쓰면 반드시 한 번 어긋난다.
- DOM 사실은 관찰 날짜와 **무엇을 보고 적었는지**(실측, post-state 관찰, 가정)를 함께 남긴다. 확인되지 않은 것을 확인된 것처럼 적으면 검증 계층이 그 문장으로 fixture를 만든다.

## module 문서
- 코드 폴더 안에는 markdown을 두지 않는다. `src/<folder>`와 `e2e/`의 설명은 `docs/modules/<folder>.md`에 쓰고, 루트 `AGENTS.md`의 표에서 잇는다.
- 절은 Owns, Common changes, Non-obvious, Dependencies 네 개다. 제품 규칙을 복제하지 않고 해당 `docs/` 문서를 링크한다.
- 새 최상위 코드 폴더를 만들면 module 문서와 루트 표 항목을 같은 PR에서 추가한다.

## investigation과 Issue 중 어디에
- 코드 작업 중 agent가 참고해야 할 가설(어느 구현 경계를 의심하는지, 재현 시 무엇을 수집할지)이 있으면 `docs/investigations/`에 쓴다. 저장소 안에 있어야 코드와 함께 읽힌다.
- 그런 가설 없이 "나중에 보자"만 남기는 것이면 GitHub Issue로 충분하다.
- investigation의 가설을 확정된 Known Issue, troubleshooting 절차나 제품 계약처럼 쓰지 않는다. 재현되면 회귀 테스트와 구현을 먼저 고치고, 계약 변경이 있으면 source of truth를 갱신한 뒤 note를 정리한다.

## 용어
- 새 개념이 생기면 `CONTEXT.md`에 정의와 `_Avoid_` 목록을 추가한다. 문서와 코드 주석은 그 표기를 쓴다.
- 기존 개념을 한국어로 다르게 부르는 새 용어를 만들지 않는다.

## 공통
- 문서를 옮기거나 이름을 바꾸면 `npm run verify:docs`로 끊어진 링크를 확인한다. 백틱 경로는 검사 대상이 아니므로 grep으로 따로 본다.
- `docs/README.md`는 문서 지도다. 사람이 찾아 들어갈 문서를 새로 만들면 표에 한 줄 추가한다.
- 루트 `README.md`는 사용자가 명시적으로 요청하지 않는 한 수정하지 않는다.
- 제품·아키텍처 세부 규칙을 `AGENTS.md`나 `workflow/`에 복제하지 않는다. 해당 `docs/` 문서를 갱신하고 링크한다.
