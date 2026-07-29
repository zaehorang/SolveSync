export const MAX_ACCEPTED_CODE_BYTES = 256 * 1024;
export const MAX_ACCEPTED_TITLE_CODE_POINTS = 300;
export const MAX_ACCEPTED_PLATFORM_ID_LENGTH = 128;
export const MAX_ACCEPTED_TITLE_SLUG_LENGTH = 128;
export const MAX_ACCEPTED_LANGUAGE_LENGTH = 64;
export const MAX_ACCEPTED_URL_LENGTH = 2_048;

export function acceptedCodeByteLength(code: string): number {
  return new TextEncoder().encode(code).byteLength;
}

export function isAcceptedCodeWithinLimit(code: unknown): code is string {
  return (
    typeof code === "string" &&
    code.trim().length > 0 &&
    acceptedCodeByteLength(code) <= MAX_ACCEPTED_CODE_BYTES
  );
}

export function isAcceptedTextWithinLimit(
  value: unknown,
  maxLength: number
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxLength
  );
}

export function isAcceptedTitleWithinLimit(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    Array.from(value).length <= MAX_ACCEPTED_TITLE_CODE_POINTS
  );
}

export function isAcceptedHttpsUrlWithinLimit(value: unknown): value is string {
  if (typeof value !== "string" || value.length > MAX_ACCEPTED_URL_LENGTH) {
    return false;
  }

  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
