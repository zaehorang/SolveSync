# Commands

검증 명령과 변경 종류별로 함께 확인할 것의 목록이다. 저장소 루트에서 실행한다. pre-push와 CI가 같은 명령을 돌리므로, 여기서 통과하면 gate도 통과한다.

## 기본 검증

```bash
npm run typecheck
npm test
npm run build
```

변경 범위가 작으면 관련 Vitest 파일을 먼저 실행해도 된다. 최종 build는 content IIFE bundle 검증까지 포함한다. `scripts/verify_extension_build.mjs`가 content entry와 SWEA MAIN world bridge에 static ESM `import`가 남지 않았는지 검사하므로 손으로 확인하지 않아도 된다.

## 범위별 추가 검증

`workflow/gates/`를 바꿨으면 함께 돌린다. CI가 실행하는 것과 같은 명령이다.

```bash
python3 -m unittest discover -s workflow/gates/tests -t workflow/gates
```

`docs/`, `workflow/`나 `*.md`에서 파일을 옮기거나 링크를 바꿨으면 함께 돌린다. CI가 같은 명령을 실행한다.

```bash
npm run verify:docs
```

상대 markdown 링크가 실제 파일을 가리키는지만 본다. 백틱 경로는 검사하지 않는다. 문서에는 저장소 경로와 사용자 Sync Repository 경로가 같은 표기로 섞여 있어 기계가 구분할 수 없다.

`e2e/`, content script나 `manifest.json`을 바꿨으면 Sealed 계층도 돌린다. CI가 별도 job으로 실행한다.

```bash
npm run build && npm run e2e
```

`npm run e2e`는 secret 없이 도는 계층만 실행한다. Contract Check와 풀사이클은 env guard로 스스로 건너뛴다. 실제 제출이 필요한 계층은 [`e2e/README.md`](../e2e/README.md)를 따른다.

## 배포 산출물

Chrome Web Store 제출과 GitHub Release에 쓰는 ZIP은 `npm run package:chrome`이 만든다. `dist` 내용만 담고 필수/금지 경로를 검증한다. 문서와 `src/`는 들어가지 않는다.

## Node 버전

Node는 `package.json`의 `engines`가 하한을 정한다. `.github/workflows/ci.yml`은 그 하한 버전을 고정해서 돌리므로 로컬이 더 새 버전이어도 CI가 하한을 검증한다. 하한을 올릴 때는 두 곳을 함께 바꾼다.

## 변경 종류별 확인 목록

- 제품 동작이나 scope 변경: `docs/PRD.md` 확인.
- architecture, storage, runtime message, API boundary 변경: `docs/ARCHITECTURE.md`와 `docs/adr/` 확인. 결정이 바뀌면 새 ADR([authoring](authoring.md)).
- UI layout, copy, locale, accessibility 변경: `docs/UI_GUIDE.md` 확인.
- sync flow 또는 browser 검증 영향: `docs/MANUAL_VALIDATION.md` 갱신 필요 여부 확인.
- Coding Platform 감지, adapter, 오류 코드 변경: `docs/platforms/`의 해당 플랫폼 문서와 README 표 확인. 사용자가 보는 동작이 바뀌면 `docs/specs/`도 확인.
- 코드 module의 책임이나 의존 방향 변경: `docs/modules/`의 해당 문서 확인.
- 문서 파일 이동·이름 변경: `npm run verify:docs`로 그 파일을 가리키던 링크를 함께 확인.
- gate 규칙 변경: `workflow/gates/policy.py`와 테스트를 같은 commit에서 수정([gates](gates.md)).
