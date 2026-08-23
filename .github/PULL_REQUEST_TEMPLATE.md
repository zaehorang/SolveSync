<!--
조사와 계획의 결과물은 여기에 남는다. 이 저장소에서 이슈는 선택이고 PR body가
기록의 정본이다. 6개월 뒤에 이 PR만 읽고도 왜 이렇게 했는지 알 수 있어야 한다.
-->

## 무엇을

<!-- 바뀐 것을 한두 문장으로. 파일 목록은 diff가 이미 보여준다. -->

## 왜

<!-- 착수 근거. 어떤 문제가 있었고 왜 지금 고치는가. 대안을 검토했다면 왜 택하지 않았는지. -->

## 어떻게 검증했는가

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] 수동 검증 (`docs/MANUAL_VALIDATION.md`) — 필요한 경우 실행한 절차를 적는다

<!-- 문서만 바꾼 PR이면 위 항목 대신 확인한 source of truth 문서를 적는다. -->

## 함께 갱신한 문서

<!--
제품 동작/scope → docs/PRD.md
architecture, storage, runtime message, API boundary → docs/ARCHITECTURE.md, docs/adr/
UI layout, copy, locale, accessibility → docs/UI_GUIDE.md
sync flow 또는 browser 검증 영향 → docs/MANUAL_VALIDATION.md
해당 없으면 "없음"이라고 적는다.
-->

---

<!-- 근거가 된 이슈가 있으면 아래를 남긴다. 없으면 지운다. -->
Fixes #
