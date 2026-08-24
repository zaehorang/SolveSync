/** 캡처 결과에서 남기면 안 되는 것을 지운다.
 *
 * **회수 경로에 박는다.** 캡처한 뒤에 지우는 방식은 쓰지 않는다. 사람이
 * 한 번 잊으면 그대로 저장소에 들어가고, 커밋된 secret은 되돌릴 수 없다.
 *
 * solution code 원문은 애초에 회수하지 않고 줄 수·길이·해시로만 남긴다.
 * alert layer의 UI 문구는 사용자 데이터가 아니므로 보존한다.
 */
const SENSITIVE_ATTRIBUTES = [
  "value",
  "data-value",
  "data-code",
  "data-token",
  "data-session",
  "data-user",
  "data-email"
];

/** 지워야 할 값의 형태. 하나라도 걸리면 통째로 가린다. */
const SENSITIVE_PATTERNS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: "github-token", pattern: /\bgh[pousr]_[A-Za-z0-9]{16,}/g },
  { label: "github-pat", pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}/g },
  { label: "bearer", pattern: /\bBearer\s+[A-Za-z0-9._~+/-]{16,}=*/gi },
  { label: "jwt", pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g },
  { label: "email", pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { label: "cookie-pair", pattern: /\b(JSESSIONID|csrftoken|LEETCODE_SESSION|SESSION)=[^\s;"']+/gi }
];

export const REDACTED = "[REDACTED]";

export interface CodeDigest {
  readonly lineCount: number;
  readonly length: number;
  /** 내용을 복원할 수 없는 짧은 지문. 같은 코드인지 비교하는 용도다. */
  readonly digest: string;
}

/** solution code를 저장 가능한 형태로 줄인다. 원문은 돌려주지 않는다. */
export function digestCode(code: string): CodeDigest {
  return {
    lineCount: code.length === 0 ? 0 : code.split("\n").length,
    length: code.length,
    digest: shortHash(code)
  };
}

export function redactText(value: string): string {
  let result = value;

  for (const { pattern } of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, REDACTED);
  }

  return result;
}

/** 캡처한 HTML 조각을 저장 가능한 형태로 만든다.
 *
 * 값이 들어 있는 attribute는 내용을 보지 않고 무조건 비운다. `textarea`의
 * 내용도 같은 이유로 비운다. 어떤 attribute가 안전한지 판단하려 들면 언젠가
 * 틀린다. */
export function redactHtml(html: string): string {
  let result = html;

  for (const attribute of SENSITIVE_ATTRIBUTES) {
    result = result.replace(
      new RegExp(`(\\s${attribute}=)(".*?"|'.*?')`, "gis"),
      `$1"${REDACTED}"`
    );
  }

  result = result.replace(
    /(<textarea\b[^>]*>)([\s\S]*?)(<\/textarea>)/gi,
    `$1${REDACTED}$3`
  );

  return redactText(result);
}

/** 남으면 안 되는 것이 남았는지 되본다. 저장 직전에 부른다. */
export function findLeaks(value: string): string[] {
  return SENSITIVE_PATTERNS.filter(({ pattern }) => {
    pattern.lastIndex = 0;
    return pattern.test(value);
  }).map(({ label }) => label);
}

/** 내용 복원이 목적이 아니므로 짧고 단순한 해시로 충분하다. */
function shortHash(value: string): string {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}
