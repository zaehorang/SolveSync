---
name: e2e
description: SolveSync e2e 검증을 상황에 맞게 고르고 준비물을 챙겨 실행한다. 환경 점검, Contract Check, 기본 e2e, 풀사이클 중 선택한다. "/e2e", "e2e 돌려줘", "e2e 환경 확인", "contract check" 같은 요청에 쓴다.
---

# e2e

e2e 계층마다 명령, 준비물, 위험이 다르다. 이 skill은 **선택 → 준비물 확인 → npm 명령 실행 → 결과 표 정리** 순서로만 일한다. 판정 로직은 `e2e/support/preflight.ts`에 있고 이 skill은 그 출력을 읽는다. 계층의 정의와 이유는 [`e2e/README.md`](../../../e2e/README.md)를 따른다.

**값(token, 계정, 쿠키)은 어디에도 출력하지 않는다.** `.env`를 `cat`하지 않고 `.verification-profile/`의 파일을 열지 않는다. 쿠키 만료는 미리 판정하지 않는다. 실행 중 로그인 대기로 드러난다.

## 선택

인자가 있으면 선택을 건너뛰고 바로 해당 항목으로 간다.

| 그룹 | 인자 | 선택지 | 이럴 때 |
| --- | --- | --- | --- |
| A. 환경 확인 | `check` | 환경 점검 | 새 worktree, 오랜만의 실행, 테스트가 이유 없이 멈추거나 건너뜀 |
| | `contract` | Contract Check | 플랫폼 화면이 바뀐 것 같을 때, 감지 실패 제보 |
| B. 실제 테스트 | `default` | 기본 e2e | PR 전, 감지·동기화 로직 변경, CI e2e 실패 재현 |
| | `full-cycle` | 풀사이클 | 릴리스 직전, 제출·동기화 경로 대폭 변경 |

인자가 없으면 AskUserQuestion으로 그룹을 고르고 이어서 선택지를 고른다.

## 실행 전 가드: E2E_LIVE_SUBMIT

`npm run e2e`는 풀사이클 spec도 돌고 `playwright.config.ts`가 `.env`를 읽는다. `E2E_LIVE_SUBMIT`이 셸이나 `.env`에 남아 있으면 **확인 없이 실제 제출이 일어난다.** 환경 점검과 기본 e2e는 명령을 실행하기 전에 키가 있는지만 본다(값은 보지도 출력하지도 않는다).

```bash
[ -n "${E2E_LIVE_SUBMIT+x}" ] && echo "셸에 E2E_LIVE_SUBMIT 있음"
grep -qE '^[[:space:]]*(export[[:space:]]+)?E2E_LIVE_SUBMIT[[:space:]]*=' .env 2>/dev/null && echo ".env에 E2E_LIVE_SUBMIT 있음"
```

하나라도 출력되면 **멈추고** 사용자에게 알린다. 셸이면 `unset E2E_LIVE_SUBMIT`, `.env`면 그 줄을 지우라고 안내한다(직접 지우지 않는다). 의도한 풀사이클(`E2E_LIVE_SUBMIT=1 npm run e2e:full-cycle`)은 이 가드를 타지 않고 아래 "풀사이클" 절차의 확인을 거친다.

## 환경 점검 (`check`)

위 가드를 먼저 돌린 뒤, 저장소 루트(작업 중인 worktree)에서 다음을 돌린다.

```bash
node scripts/check_node_modules.mjs      # package-lock.json과 설치된 버전을 비교한다. 0이면 일치
ls -d "/Applications/Google Chrome.app"   # Contract Check·로그인은 실제 Chrome이 필요하다
npm run e2e:check                         # dist, .env, Chromium, E2E_LIVE_SUBMIT, GitHub, SWEA, Profile
```

남은 테스트용 Chrome은 "테스트용 Chrome 종료"의 목록 명령으로 확인한다.

`npm run e2e:check`는 테스트 없이 `[preflight]` 줄만 출력한다. 항목별 판정과 누락 시 안내:

| 항목 | 누락·실패일 때 |
| --- | --- |
| node_modules | 스크립트가 실패하면(버전 불일치는 `npm ls`가 못 잡는다) `npm ci`. 주 디렉터리의 `node_modules` symlink를 쓰는 worktree면 `package-lock.json`을 바꾼 branch인지 먼저 본다(바꿨으면 symlink 금지, `npm ci`) |
| 빌드 산출물 | `npm run build` |
| .env | 주 디렉터리의 `.env`를 현재 worktree로 **복사**한다(symlink 아님) |
| Google Chrome | `/Applications/Google Chrome.app`이 없으면 Contract Check·로그인을 못 돈다. Chrome을 설치한다 |
| E2E_LIVE_SUBMIT | `확인 실패`이면 키를 지운 뒤 실행한다. 지우기 전에는 기본 e2e를 돌리지 않는다 |
| Playwright Chromium | `npx playwright install chromium` |
| GitHub write | `확인 실패(HTTP 401)`이면 token 만료·오타, 404면 repository 이름·접근 권한. `.env`를 직접 열지 말고 사용자에게 고치라고 안내한다 |
| SWEA 자동 로그인 | 없으면 Contract Check·풀사이클에서 수동 로그인을 기다린다. 필수는 아니다 |
| Verification Profile | 없으면 `npm run e2e:login`이 필요하다. 아래 "로그인" 참고. 있어도 쿠키 만료는 알 수 없다 |
| 남은 테스트용 Chrome | 아래 "테스트용 Chrome 종료" |

결과를 항목 / 상태 / 해결책 표로 정리하고, 누락이 있으면 해결한 뒤 어느 선택지로 이어갈지(기본 e2e 또는 Contract Check) 제안한다. 환경 점검 자체는 파일을 바꾸지 않는다. 해결책 실행(`npm ci`, `playwright install`, `.env` 복사)은 사용자에게 확인하고 한다.

## 기본 e2e (`default`)

먼저 위 "E2E_LIVE_SUBMIT" 가드를 돌린다. 통과해야 아래를 실행한다.

```bash
npm run build && npm run e2e
```

Sealed 계층만 secret 없이 돈다. GitHub write 계층은 `.env`가 있어야 돌고, Contract Check와 풀사이클은 스스로 건너뛴다. **건너뜀을 통과로 읽지 않는다.** 결과 표에 건너뛴 계층과 이유(출력된 skip 사유)를 따로 적는다.

## Contract Check (`contract`)

제출하지 않는다. 확장을 켜지 않고 실제 page를 headed로 연다.

1. Verification Profile이 없으면 "로그인"을 먼저 한다. 있으면 그대로 실행한다.
2. `npm run e2e:contract`
3. 실행 중 `[manualLogin] ... 세션이 없거나 만료됐다`가 나오면 쿠키가 만료된 것이다. 사용자에게 열린 창에서 직접 로그인하라고 알린다(최대 5분 대기, 로그인하면 자동으로 이어진다).

## 풀사이클 (`full-cycle`)

**실제 계정으로 실제 채점 제출을 한다. 되돌릴 수 없고 SWEA는 문제당 제출 상한이 99회다.** 인자로 불러도 이 확인을 건너뛰지 않는다.

1. 플랫폼을 고른다: 전체 / leetcode / programmers / swea.
2. 실제 제출이 일어난다는 것과 SWEA 99회 상한을 알리고 **진행해도 되는지 명시적으로 묻는다.** 이번 호출에서 받은 승인만 유효하다.
3. 승인되면 Profile 없음 처리("로그인")를 거친 뒤 실행한다.

```bash
E2E_LIVE_SUBMIT=1 npm run e2e:full-cycle                              # 전체
E2E_LIVE_PLATFORM=swea E2E_LIVE_SUBMIT=1 npm run e2e:full-cycle       # 하나만 (leetcode|programmers|swea)
```

GitHub write 설정이 없거나 Repository 확인에 실패하면 사전 점검이 제출 전에 멈춘다. 그때는 "환경 점검"으로 돌아간다.

## 로그인 (Contract Check·풀사이클 앞)

`.verification-profile/`이 없으면(`ls -d .verification-profile`) 알리고 이어서 진행한다. 로그인은 사람이 해야 한다.

1. 사용자에게 알린다: "Verification Profile이 없어 로그인이 필요하다. Chrome이 뜨면 LeetCode·Programmers·SWEA에 로그인한 뒤 **⌘Q로 Chrome을 종료**해라."
2. `npm run e2e:login`을 백그라운드로 실행한다.
3. 종료를 기다린다. 사용자가 로그인을 마쳤다고 하고도 명령이 끝나지 않으면(macOS는 창만 닫으면 프로세스가 남는다) 아래 "테스트용 Chrome 종료"를 한다.
4. **종료 코드를 확인한다.** 0이 아니면(timeout, 실패) 이어서 실행하지 않는다. 명령이 디렉터리를 띄우자마자 만들기 때문에 `.verification-profile/`이 있다는 것은 로그인 성공의 증거가 아니다. 사용자에게 세 플랫폼에 실제로 로그인했는지 확인하라고 안내하고 멈춘다. 이 경우 SIGTERM으로 끝낸 것도 정상 종료로 보지 않는다 — 사용자가 로그인을 마쳤다고 확인한 경우에만 이어간다.
5. 종료 코드가 0이면 원래 선택지를 이어서 실행한다.

## 테스트용 Chrome 종료

종료 대상은 두 가지뿐이다. 평소 쓰는 Chrome은 건드리지 않는다.

- 로그인·Contract Check: 이 저장소의 `.verification-profile` 절대경로를 `--user-data-dir`로 받은 Chrome
- 풀사이클: `solvesync-profile-` 임시 복사본 프로필을 받은 Chromium (`$TMPDIR/solvesync-profile-*`)

```bash
# 목록. Chrome·Chromium 실행 파일의 메인 프로세스만(자식은 --type= 인자가 있다)
ps -axo pid=,args= | grep -F -e "--user-data-dir=$PWD/.verification-profile" -e "--user-data-dir=${TMPDIR%/}/solvesync-profile-" | grep -E 'Google Chrome|Chromium|chrome-mac' | grep -v -e grep -e '--type='
```

결과가 비어 있으면 남은 것이 없다. 있으면 PID와 프로필 경로를 사용자에게 보여주고 승인받은 PID에만 `kill -TERM <pid>`를 보낸다. 자식은 따라서 끝난다. 몇 초 뒤 같은 목록 명령으로 사라졌는지 확인한다. `kill -9`는 쓰지 않는다 — 프로필이 상한다. 다른 worktree의 프로필 경로가 보이면 그쪽 작업일 수 있으니 건드리지 않는다.

## 결과 정리

실행 뒤 계층별로 정리한다.

| 계층 | 결과 | 비고 |
| --- | --- | --- |
| 이름 | 통과 / 실패 / 건너뜀 | 실패는 단언 메시지 요약, 건너뜀은 사유 |

실패한 실행의 `test-results/`는 로그인 흐름 trace를 담을 수 있다. 공유하거나 issue에 첨부하라고 안내하지 않는다.
