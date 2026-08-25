# SWEA bridge 검증 두 항목 마무리

> **상태**: 착수 가능. 나머지 검증 계층은 전부 끝났다(2026-08-26).
>
> 이 파일 하나만 보고 진행할 수 있게 썼다. 끝나면 이 파일을 지운다.

## 왜 남았나

검증 네 계층(Sealed, GitHub write, Contract Check, 풀사이클)이 세 플랫폼에서 모두 통과한다. SWEA의 MAIN world bridge **왕복**도 풀사이클이 실증했다 — SWEA code는 bridge로만 오고, 실행마다 붙는 nonce 주석이 commit된 파일에서 확인된다.

남은 둘은 **계층이 없어서가 아니라 조건을 만들지 않아서** 비어 있다.

| | 항목 | 왜 아직 비었나 |
|---|---|---|
| A | 가상 스크롤 밖 줄을 포함한 `getValue()` | 검증용 풀이가 49줄이라 화면 밖으로 나가지 않는다 |
| B | bridge가 code를 못 읽을 때 `swea_extract_failed`로 수렴 | 그 상태를 만들 장치를 두지 않았다 |

근거와 현재 표기는 [`docs/platforms/SWEA.md`](../platforms/SWEA.md)의 자동 검증 절에 있다. 작업이 끝나면 그 절의 "아직 덮이지 않은 것 둘"을 함께 고친다.

## 먼저 읽을 것

- [`e2e/README.md`](../../e2e/README.md) — 네 계층의 실행 방법
- [`e2e/CLAUDE.md`](../../e2e/CLAUDE.md) — 이 디렉터리의 비직관적 규칙
- [`docs/platforms/SWEA.md`](../platforms/SWEA.md) — 플랫폼 계약과 실측값

## A. 가상 스크롤 밖 줄

### 무엇을 확인하나

SWEA editor는 CodeMirror이고 **화면에 보이는 줄만 DOM에 그린다.** bridge는 DOM이 아니라 editor instance의 `getValue()`를 부르므로 화면 밖 줄도 와야 한다. 그 전제가 실제로 맞는지를 본다. 틀리면 긴 풀이가 잘린 채 commit된다.

`e2e/drivers/swea.ts`의 `assertContract`가 editor instance의 존재까지는 이미 확인한다. 여기서 더 필요한 것은 **길이**다.

### 하는 일

1. **60줄 이상 정답 풀이**를 만들어 `e2e/fixtures/solutions/swea.accepted.py`를 대체하거나 옆에 새로 둔다. 기준 문제는 1206(`AV134DPqAA8CFAYh`).
   - **SWEA sandbox는 `import`와 `open`을 막는다. 표준입력은 `input()`뿐이다.** 기존 파일이 그 제약 안에서 쓰여 있으니 그대로 따른다.
   - 줄 수를 늘리려고 의미 없는 주석만 붙이지 않는다. 주석은 CodeMirror가 접거나 다르게 다룰 수 있어 검증이 약해진다. 실제 코드 줄로 늘린다.
2. editor에 넣은 뒤 **스크롤이 실제로 생겼는지** 확인한다. 60줄이 기준인 이유는 화면 높이 추정일 뿐이므로, `.CodeMirror-line` 개수가 전체 줄 수보다 적은 것을 실측으로 확인한다. 같으면 줄을 더 늘린다.
3. 풀사이클을 1회 돌린다.
4. `e2e/full-cycle.spec.ts`의 검증에 **줄 수 단언**을 더한다. 지금은 nonce 포함만 본다. commit된 파일의 줄 수가 넣은 코드와 같아야 한다.

### 비용

**SWEA 제출 1회.** 문제당 상한이 99회이고 현재 사용량은 문제 page에 `제출횟수 N / 99`로 표시된다. 착수 전에 그 숫자를 읽어 기록해라.

제출 앞의 문 넷(대상 저장소·로그인·dry-run·nonce)은 그대로 둔다. 특히 dry-run은 채점 없이 예제와 대조하므로 **새 풀이가 정답인지 여기서 먼저 걸러진다.** 우회하지 않는다.

## B. bridge가 code를 못 읽을 때

### 무엇을 확인하나

`src/background/sourceResolver.ts`의 `resolveSweaSource`는 code가 비어 있으면 `swea_extract_failed`를 돌려준다. 그 수렴이 실제 확장에서 일어나는지를 본다. bridge가 깨졌을 때 **조용히 빈 파일이 commit되지 않는 것**이 이 항목의 값이다.

### 권하는 방법 — Sealed로 한다

실제 page가 필요 없고 네트워크도 타지 않는다. `resolveSweaSource`가 GitHub 호출 **앞에서** 끝나기 때문이다.

1. `e2e/drivers/swea.ts`의 sealed 뼈대를 그대로 쓰되 **editor instance가 없는 변형**을 만든다. 지금 뼈대에는 `.CodeMirror` host 자체가 없으므로 이미 그 조건이다.
2. `e2e/sealed.spec.ts`는 GitHub 미설정 상태로 돌아 `setup_required`에서 멈춘다. 이 항목은 그 앞을 지나야 하므로 **auth와 settings를 심는다** — `seedGitHubAuthSession`과 `settings:write`를 쓴다(`e2e/github-write.spec.ts`가 그대로 한다). token은 아무 값이어도 된다. GitHub 호출까지 가지 않는다.
3. Accepted 결과 text를 재생하고, Sync History에 `swea_extract_failed`가 남는 것을 단언한다.

**주의**: 이 방법이 실증하는 것은 "editor instance가 없을 때"다. 진짜 bridge 미주입(manifest가 script를 안 넣는 상태)은 아니다. 둘의 실패 경로가 같다는 것은 코드로 확인되지만, **문서에는 실제로 검증한 조건을 그대로 적어라.** 이 저장소가 반복해서 지켜온 규칙이다.

## 끝나면

- [`docs/platforms/SWEA.md`](../platforms/SWEA.md) 자동 검증 절의 "아직 덮이지 않은 것 둘"을 실측 결과로 교체한다. 관찰 일자와 근거 파일을 함께 적는다.
- A를 했다면 SWEA 제출 횟수를 기록에 남긴다.
- 이 파일을 지운다. `docs/plans/`가 비면 디렉터리도 지운다.

## 하지 말 것

- 제출 앞의 guard를 우회하지 않는다. 제출은 되돌릴 수 없다.
- 실제 page의 selector나 문구를 추측해서 코드에 박지 않는다. 사용자 Chrome이 로그인돼 있으므로 `mcp__claude-in-chrome__javascript_tool`로 직접 잰다.
- solution code 원문을 fixture, log, PR body에 남기지 않는다. 줄 수·길이·해시로만 남긴다. 단 `e2e/fixtures/solutions/`의 검증용 풀이는 우리가 쓴 것이라 해당하지 않는다.
