/** 하네스 배선 확인용 최소 page.
 *
 * **실제 SWEA page가 아니다.** 캡처 기반 fixture는 Phase 1이 만들고
 * `e2e/fixtures/`에 들어간다. 여기서 확인하는 것은 manifest match가 걸리고
 * content bundle이 실제 Chrome에서 로드되는가뿐이다.
 */
export const MINIMAL_SWEA_URL =
  "https://swexpertacademy.com/main/solvingProblem/solvingProblem.do";

export const MINIMAL_SWEA_HTML = `<!doctype html>
<html lang="ko">
  <head><meta charset="utf-8"><title>harness fixture</title></head>
  <body>
    <input id="contestProbId" type="hidden" value="AV000HARNESS" />
    <h3 class="problem_title">1234. 하네스 확인용</h3>
    <select id="sel_lang"><option value="Y" selected>Python</option></select>
  </body>
</html>`;
