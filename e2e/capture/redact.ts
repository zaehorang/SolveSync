/** 캡처 결과에서 남기면 안 되는 것을 지운다.
 *
 * **회수 경로에 박는다.** 캡처한 뒤에 지우는 방식은 쓰지 않는다. 사람이
 * 한 번 잊으면 그대로 저장소에 들어가고, 커밋된 secret은 되돌릴 수 없다.
 *
 * solution code 원문은 애초에 회수하지 않고 줄 수·길이·해시로만 남긴다.
 * alert layer의 UI 문구는 사용자 데이터가 아니므로 보존한다.
 */
import type { Recording } from "./recorder";

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

/** 실행 시점에만 알 수 있는 비밀 문자열. 계정 정보가 여기 들어온다.
 *
 * 패턴으로는 잡을 수 없다 — 아이디는 형태가 정해져 있지 않다. SWEA는 로그인하면
 * header에 사용자 이름을 그리므로 계정 문자열이 캡처 DOM에 그대로 섞여 들어올 수
 * 있다. 값을 알고 있을 때만 지울 수 있으므로 caller가 `.env`에서 읽어 등록한다.
 * 이 module은 값을 보관만 하고 어디에도 찍지 않는다. */
const registeredSecrets: { label: string; pattern: RegExp }[] = [];

/** 정규식 특수문자를 글자 그대로 매칭되게 만든다. 비밀번호에는 무엇이든 온다. */
function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 지울 비밀 문자열을 등록한다. 캡처를 시작하기 전에 부른다.
 *
 * 너무 짧은 값은 무시한다. 두 글자짜리를 전역 치환하면 무관한 DOM 텍스트가 통째로
 * 망가져 캡처가 쓸모없어진다. 그 정도로 짧으면 캡처에 섞여도 식별 정보가 되지 못한다. */
export function registerSecrets(values: readonly string[]): void {
  registeredSecrets.length = 0;

  for (const value of values) {
    const trimmed = value.trim();

    if (trimmed.length < 3) {
      continue;
    }

    registeredSecrets.push({
      label: "account",
      pattern: new RegExp(escapeForRegExp(trimmed), "g")
    });
  }
}

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

  for (const { pattern } of [...SENSITIVE_PATTERNS, ...registeredSecrets]) {
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

/** node 하나의 html·text를 redact한다. */
function redactNode<T extends { html?: string; text?: string }>(node: T): T {
  return {
    ...node,
    html: node.html === undefined ? undefined : redactHtml(node.html),
    text: node.text === undefined ? undefined : redactText(node.text)
  };
}

/** Recording 전체를 구조화된 상태에서 redact한다.
 *
 * **JSON.stringify 이후 문자열에 `redactHtml`을 걸지 않는다.** JSON 안에서
 * 따옴표는 `\"`로 escape돼 있는데, `redactHtml`의 attribute 정규식은 raw
 * HTML의 `attr="..."` 형태를 가정한다. escape를 모르는 정규식이 JSON
 * 문자열 중간에서 매칭·치환되면 escape가 깨져 JSON 자체가 깨진다(실측 —
 * LeetCode capture가 이 경로에서 SyntaxError로 통째로 실패했다). node의
 * html·text 필드가 아직 원문 문자열일 때, 즉 JSON으로 직렬화하기 전에
 * redact한다. */
export function redactRecording(recording: Recording): Recording {
  return {
    ...recording,
    batches: recording.batches.map((batch) => ({
      ...batch,
      mutations: batch.mutations.map((mutation) => ({
        ...mutation,
        oldValue: mutation.oldValue === undefined || mutation.oldValue === null ? mutation.oldValue : redactText(mutation.oldValue),
        target: redactNode(mutation.target),
        addedNodes: mutation.addedNodes.map(redactNode),
        removedNodes: mutation.removedNodes.map(redactNode)
      }))
    })),
    dialogs: recording.dialogs.map((dialog) => ({ ...dialog, message: redactText(dialog.message) }))
  };
}

/** 남으면 안 되는 것이 남았는지 되본다. 저장 직전에 부른다. */
export function findLeaks(value: string): string[] {
  return [...SENSITIVE_PATTERNS, ...registeredSecrets]
    .filter(({ pattern }) => {
      pattern.lastIndex = 0;
      return pattern.test(value);
    })
    .map(({ label }) => label);
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
