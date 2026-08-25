# Phase 4 — 플랫폼 3 병렬

> **선행**: Phase 3.
> **산출**: 세 플랫폼의 드라이버, Sealed·Contract Check·풀사이클 통과, 플랫폼 문서 갱신.
> **담당**: 에이전트 3개 병렬.

## 병렬이 성립하는 이유

Phase 2가 플랫폼 로직을 구현체 파일로 나눴고, Phase 3이 공통 spec과 드라이버 인터페이스를 확정했다. 각 에이전트가 만지는 파일은 둘뿐이다.

```
src/content/platforms/{platform}.ts     (필요 시 보강)
e2e/drivers/{platform}.ts               (신규)
e2e/fixtures/{platform}/                (Phase 1 산출물 사용)
docs/platforms/{PLATFORM}.md            (관찰 강도 갱신)
```

`SealedFixture`는 Phase 3에서 확정됐다. **최소 뼈대 page는 드라이버가 짓고 판정 text는 캡처에서 온다.** 그 text가 캡처에 실재하는지 공통 spec이 재생 전에 확인하므로 지어낸 문자열은 통과하지 못한다. `e2e/drivers/swea.ts`가 본보기다.

SWEA의 bridge 세 항목(왕복, 가상 스크롤 밖 줄, 미주입 시 `swea_extract_failed`)이 Phase 3에서 여기로 넘어왔다. Sealed fixture로 덮이지 않는다 — 캡처가 code를 회수하지 않고 가상 스크롤은 실제 CodeMirror가 있어야 성립한다.

드라이버 등록만 예외다. `e2e/drivers/index.ts`의 `DRIVERS`에 **자기 것 한 줄만 append한다.** 그 줄이 없으면 공통 spec이 그 플랫폼을 돌지 않는다.

**나머지 공유 파일은 건드리지 않는다.** `e2e/support/`, 공통 spec, `package.json`, `.github/workflows/ci.yml`, `platforms/types.ts`는 Phase 3에서 확정됐다. 부족한 것이 나오면 **직접 고치지 말고 보고한다.** 셋이 각자 고치면 기반이 갈라지고, 그 순간 셋 다 통과하는데 아무것도 검증하지 않는 상태가 된다.

## 플랫폼별 작업

### SWEA

| 계층 | 확인할 것 |
|---|---|
| Sealed | bridge 왕복, 가상 스크롤 밖 줄 포함 `getValue()`(60줄 이상 fixture), bridge 미주입 시 `swea_extract_failed` 수렴 |
| Contract Check | `input#contestProbId`, `h3.problem_title`, `select#sel_lang`, `.CodeMirror` host + 제출 selector |
| 풀사이클 | 기준 문제 1206(`AV134DPqAA8CFAYh`) 자동 제출 → commit 검증 |

- 문제당 제출 상한 99회. 풀사이클 실행 횟수를 기록한다.
- Python 제출에서 `import sys`가 컴파일 오류로 거부된다(2026-08-18 관찰). `input()`으로 쓴다.
- 지원 언어는 `cpp`, `java`, `python3` 셋뿐이다.

### Programmers

| 계층 | 확인할 것 |
|---|---|
| Sealed | `#modal-dialog` 전이에서 event 1회, `acceptedVisible → acceptedVisible`은 0회, 닫은 뒤 두 번째 Accepted, 실패 modal에서 0회 |
| Contract Check | `#modal-dialog` 존재, `textarea#code` 도달과 **값 갱신 여부** |
| 풀사이클 | 기준 lesson 자동 제출 → commit 검증 |

- **Sealed fixture는 실제 layout이 필요하다.** visibility 판정이 computed style에 의존해 jsdom으로는 원리상 덮이지 않는다. 이 플랫폼에서 Sealed E2E의 가치가 가장 크다.
- Phase 1이 답한 다섯 가지(node 재사용, text 경로, 실패 root 공유, batch 경계)를 fixture가 그대로 재현해야 한다.
- `acceptedSourceId`에 `codeHash`가 들어간다. 풀사이클 반복 시 코드에 타임스탬프 주석을 붙이지 않으면 두 번째 실행이 dedup에 걸려 **거짓 통과**한다.

### LeetCode

| 계층 | 확인할 것 |
|---|---|
| Sealed | 결과 panel 감지, `Acceptance Rate`·`Accepted Submissions` 일반 copy에서 event 0회, SPA 이동 후 현재 `titleSlug` |
| Contract Check | **완료.** `/problems/{titleSlug}`가 공개라 로그인 불필요. 단 headed로만 된다 — headless는 Cloudflare가 막는다 |
| 풀사이클 | 기준 문제 자동 제출 → GraphQL source 조회까지 실증 |

- **Sealed의 종료점은 Sync History 도달까지다.** code가 DOM이 아니라 background GraphQL에서 오므로 그 아래는 `src/background/client/leetcode.test.ts`가 덮는다. 셋 중 Sealed가 가장 얇은 것이 정상이며, `codeSource`가 `none`인 것으로 인터페이스에 이미 드러나 있다.
- 이 플랫폼은 Contract Check와 풀사이클이 주력이다.
- 실패 제출에서 sync가 없을 뿐 아니라 **source 조회 오류 toast도 나타나지 않아야 한다.** 세 플랫폼 중 유일하게 실패 시 GraphQL 조회 경로가 있어 stale Accepted를 재사용하면 여기서 드러난다.

## 각 PR이 함께 갱신할 것

- `docs/platforms/{PLATFORM}.md`의 관찰 강도와 관찰 일자, 기준 문제
- 해당 플랫폼의 자동 검증 절
- 관찰이 문서와 다르면 **문서와 구현을 함께** 고친다

## 풀사이클의 전제

`e2e/full-cycle.spec.ts`가 세 플랫폼을 같은 시나리오로 돌린다. 제출 조작은 `e2e/capture/drivers.ts`를 재사용한다 — selector를 두 곳에 두지 않는다.

**남은 것은 코드가 아니라 로그인이다.** Verification Profile의 세 세션이 모두 만료돼 있고(2026-08-25 확인), 로그인은 자격증명을 저장소에 두지 않기 위해 사람이 한다. SWEA만 `.env`의 `E2E_SWEA_ID`/`E2E_SWEA_PASSWORD`가 있으면 자동이다.

## 완료 조건

- [ ] 세 플랫폼의 드라이버가 공통 spec을 통과한다.
- [ ] 세 플랫폼의 Contract Check가 실제 page에서 통과한다.
- [ ] 세 플랫폼의 풀사이클이 실제 Accepted → 실제 commit을 실증한다.
- [ ] 각 플랫폼 문서의 관찰 강도가 "실증"으로 갱신된다.
- [ ] Phase 4 이후 `docs/plans/e2e/`를 지운다.
