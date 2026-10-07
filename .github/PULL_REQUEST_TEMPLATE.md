<!--
조사와 계획의 결과물은 여기에 남는다. 이 저장소에서 이슈는 선택이고 PR body가
기록의 정본이다. 6개월 뒤에 이 PR만 읽고도 왜 이렇게 했는지 알 수 있어야 한다.

PR 제목: `type: 사용자가 보는 변화`
type은 branch type과 같다: feat, fix, docs, test, refactor, chore, ci.
범위가 도움이 될 때만 괄호로 붙인다: fix(swea): ...
fix는 구현이 아니라 증상과 조건을 쓴다.
  좋음: fix: 화면 밖으로 스크롤된 줄이 SWEA 풀이에서 빠진다
  나쁨: fix: sweaEditorBridge에 null check를 추가한다

근거가 된 이슈가 있으면 맨 아래에 `Fixes #<number>` 또는 `Related: #<number>`를 남긴다.
-->

## 해결하는 문제

<!--
구체적인 사용자·제품·운영 문제를 쉬운 말로 한 문장.
fix는 "<어떤 조건>에서 <무엇이 잘못된다>" 형태로 쓴다.
버그가 아닌 변경은 없는 버그를 지어내지 말고 필요를 쓴다.
코드 수준 원인이 아니라 영향받는 흐름(Accepted 감지, sync, Options 설정 등)을 적는다.
-->

## 사용자 영향

<!--
이제 사용자·개발자·agent가 무엇을 할 수 있거나 기대할 수 있는지 한 문장.
내부 변경이면 "사용자에게 보이는 변화 없음"이라고 쓰고 효과를 지어내지 않는다.
위험, 호환성 깨짐, storage migration, 사용자가 해야 할 조치는 여기서 드러낸다.
<details> 안에 숨기지 않는다.
-->

## 왜 이렇게 바꿨는가

<!--
변경이 문제를 어떻게 해결하는지 짧게. 사용자 영향을 반복하지 않는다.
검토했다가 택하지 않은 대안이 있으면 왜 택하지 않았는지 적는다.
파일 목록과 원인 추적의 긴 설명은 diff나 <details>에 둔다.
-->

## 근거

<!--
이 변경이 동작한다는 가장 유용한 증거를 보인다. 실행한 명령과 결과, 집중 테스트,
CI 결과, e2e 계층, 수동 검증(docs/MANUAL_VALIDATION.md) 절차, 화면 캡처 모두 된다.
diff를 다시 서술하지 말고 무엇을 확인했고 결과가 어땠는지, 확인하지 못한 빈틈은
무엇인지 적는다. 긴 출력은 <details>에 넣되 요약은 밖에 둔다.

UI(Options, Popup, Toast) 문구나 레이아웃을 바꿨으면 전후 화면 캡처를 붙인다.
token, device code, cookie, 이메일, private repository와 solution code는 가린다.
체크박스만 채운 검증은 근거가 아니다.
-->

## 함께 갱신한 문서

<!--
제품 동작/scope → docs/PRD.md
architecture, storage, runtime message, API boundary → docs/ARCHITECTURE.md, docs/adr/
UI layout, copy, locale, accessibility → docs/UI_GUIDE.md
sync flow 또는 browser 검증 영향 → docs/MANUAL_VALIDATION.md
Coding Platform 감지, adapter, 오류 코드 → docs/platforms/
해당 없으면 "없음"이라고 적는다.
-->
