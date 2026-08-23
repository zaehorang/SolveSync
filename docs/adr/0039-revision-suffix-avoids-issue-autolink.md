# Solution Revision Number는 `#n` 대신 `(rev n)`으로 표기한다

상태: Accepted.

결정: commit message 끝의 Solution Revision Number suffix를 `#n`에서 `(rev n)`으로 바꾼다. ADR 0027이 정한 "매 반영마다 번호를 올려 commit message에 포함한다"는 결정 자체는 유지하고 표기만 교체한다. revision 1도 suffix를 생략하지 않는다. 이미 `#n`으로 만들어진 과거 commit은 rewrite하지 않는다.

이유: GitHub은 commit message의 `#n`을 같은 저장소의 issue/PR n번 참조로 해석한다. Sync Repository에 issue가 하나라도 생기는 순간, 그 번호와 우연히 겹치는 과거 solve commit들이 전부 해당 issue의 timeline에 참조로 달라붙는다. Sync Repository는 사용자의 저장소이고 SolveSync가 그곳의 issue 사용 여부를 통제할 수 없다. 한 번 붙은 참조는 commit message를 rewrite해야만 떨어지므로, 되돌릴 수 없는 오염을 표기 변경만으로 미리 막는다.

트레이드오프: 같은 저장소 안에 두 가지 표기가 공존한다. 과거 commit을 rewrite하면 표기는 통일되지만 이미 배포된 commit sha가 전부 바뀌고, 그 대가가 표기 일관성보다 크다. 표기가 세 글자 길어지고, revision 1에도 `(rev 1)`이 붙어 첫 풀이 commit에 정보량 없는 suffix가 남는다. revision 1을 생략하는 규칙을 두면 짧아지지만 message 형식이 조건부로 갈라지므로 택하지 않았다.
