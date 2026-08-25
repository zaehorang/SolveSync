import { afterEach, describe, expect, it } from "vitest";

import {
  REDACTED,
  digestCode,
  findLeaks,
  redactHtml,
  redactText,
  registerSecrets
} from "./redact";

describe("캡처 redaction", () => {
  // 등록한 비밀은 module 상태로 남는다. 테스트끼리 새지 않게 비운다.
  afterEach(() => {
    registerSecrets([]);
  });

  it("solution code를 원문 없이 줄 수·길이·해시로만 남긴다", () => {
    const code = "a = 1\nb = 2\nprint(a * b)\n";
    const digest = digestCode(code);

    expect(digest.lineCount).toBe(4);
    expect(digest.length).toBe(code.length);
    expect(JSON.stringify(digest)).not.toContain("print");
  });

  it("같은 code는 같은 지문, 다른 code는 다른 지문을 만든다", () => {
    expect(digestCode("solution\n").digest).toBe(digestCode("solution\n").digest);
    expect(digestCode("solution\n").digest).not.toBe(digestCode("solution \n").digest);
  });

  it("token, session, 계정 식별자를 지운다", () => {
    // 값을 조립해서 만든다. 리터럴로 두면 저장소의 secret gate가 진짜와
    // 구별하지 못해 커밋이 막힌다. gate가 그렇게 동작하는 것이 맞다.
    const samples = [
      ["ghp", "0123456789abcdefghijABCDEFGHIJ0123"].join("_"),
      ["github", "pat", "11ABCDEFG0123456789_abcdefghij"].join("_"),
      `Authorization: ${["Bearer", "abcdefghijklmnopqrstuvwxyz012345"].join(" ")}`,
      ["eyJhbGciOiJIUzI1NiJ9", "eyJzdWIiOiIxMjM0NTY3ODkwIn0", "dBjftJeZ4CVPmB92K27u"].join("."),
      ["user", "example.com"].join("@"),
      ["JSESSIONID", "ABCDEF0123456789"].join("=")
    ];

    for (const sample of samples) {
      const redacted = redactText(sample);

      expect(redacted).toContain(REDACTED);
      expect(findLeaks(redacted)).toEqual([]);
    }
  });

  it("값이 담기는 attribute를 내용과 무관하게 비운다", () => {
    const html = '<input id="contestProbId" value="AV134DPqAA8CFAYh" />';

    // 안전해 보이는 값이라도 판단하지 않는다. 판단하려 들면 언젠가 틀린다.
    expect(redactHtml(html)).toBe(`<input id="contestProbId" value="${REDACTED}" />`);
  });

  it("textarea 내용을 비운다", () => {
    const html = "<textarea id=\"code\">print(120804)\n</textarea>";

    expect(redactHtml(html)).toBe(`<textarea id="code">${REDACTED}</textarea>`);
    expect(redactHtml(html)).not.toContain("120804");
  });

  it("alert layer의 UI 문구는 보존한다", () => {
    const html = '<div class="layer_alert md"><div class="txt">축하합니다. Pass입니다.</div></div>';

    // 사용자 데이터가 아니다. 이걸 지우면 fixture가 쓸모없어진다.
    expect(redactHtml(html)).toBe(html);
  });

  it("등록한 계정 문자열을 지운다", () => {
    // 아이디는 형태가 정해져 있지 않아 패턴으로 잡을 수 없다. SWEA는
    // 로그인하면 header에 사용자 이름을 그리므로 캡처 DOM에 그대로 섞인다.
    registerSecrets(["solvesync-tester"]);

    const redacted = redactText("<span>solvesync-tester님</span>");

    expect(redacted).toBe(`<span>${REDACTED}님</span>`);
    expect(findLeaks(redacted)).toEqual([]);
    expect(findLeaks("<span>solvesync-tester님</span>")).toContain("account");
  });

  it("정규식 특수문자가 든 비밀도 글자 그대로 지운다", () => {
    registerSecrets(["a.b*c+d"]);

    // escape하지 않으면 `.`이 아무 글자에나 걸려 무관한 텍스트를 망가뜨린다.
    expect(redactText("axbxcxd")).toBe("axbxcxd");
    expect(redactText("a.b*c+d")).toBe(REDACTED);
  });

  it("너무 짧은 값은 등록하지 않는다", () => {
    // 두 글자를 전역 치환하면 무관한 DOM 텍스트가 통째로 망가진다.
    registerSecrets(["ab"]);

    expect(redactText("abcdef")).toBe("abcdef");
    expect(findLeaks("abcdef")).toEqual([]);
  });

  it("findLeaks가 남은 값을 이름으로 알려준다", () => {
    expect(findLeaks("정상 문구")).toEqual([]);
    expect(findLeaks(["ghp", "0123456789abcdefghijABCDEFGHIJ0123"].join("_"))).toContain(
      "github-token"
    );
  });
});
