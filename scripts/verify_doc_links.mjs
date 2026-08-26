// 문서 안의 상대 링크가 실제 파일을 가리키는지 검사한다.
//
// agent는 문서가 가리키는 경로를 그대로 따라간다. 링크가 깨져 있으면 없는 파일을
// 찾다가 추측으로 넘어가고, 그 추측은 문서를 믿은 결과라 되돌리기 어렵다. 파일을
// 옮기거나 이름을 바꿀 때 문서를 함께 고치는 것을 사람이 기억하는 대신 여기서 막는다.
//
// **상대 markdown 링크만 본다.** 백틱 경로(`docs/adr/`)는 검사하지 않는다. 이
// 저장소의 문서에는 저장소 경로와 사용자 Sync Repository 경로가 같은 표기로 섞여
// 있다. `leetcode/python/0001_two_sum.py`는 제품이 사용자 저장소에 만드는 산출물이지
// 이 저장소의 파일이 아니다. 실측하면 백틱 경로 287건 중 54건이 그런 것들이라
// 기계가 구분할 수 없고, 검사에 넣으면 예외 목록만 자라다가 gate가 무력해진다.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

const IGNORED_DIRS = new Set(["node_modules", ".git", "dist", "coverage"]);

// `[텍스트](경로)` 중 상대 경로만. 외부 URL, 페이지 내 anchor, mailto는 건너뛴다.
// 경로 뒤 `#anchor`는 링크 대상이 아니므로 떼어내고 파일 존재만 본다.
const RELATIVE_LINK = /\[[^\]]*\]\((?!https?:\/\/|#|mailto:)([^)\s#]+)(?:#[^)]*)?\)/g;

function collectMarkdown(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      found.push(...collectMarkdown(join(dir, entry.name)));
    } else if (entry.name.endsWith(".md")) {
      found.push(join(dir, entry.name));
    }
  }
  return found;
}

const files = collectMarkdown(root);
const broken = [];
let checked = 0;

for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(RELATIVE_LINK)) {
    // URL 인코딩된 경로(공백이 %20 등)를 실제 파일 이름으로 되돌린다.
    let target;
    try {
      target = decodeURIComponent(match[1]);
    } catch {
      target = match[1];
    }
    checked += 1;
    if (!existsSync(resolve(dirname(file), target))) {
      broken.push({ file: relative(root, file), target: match[1] });
    }
  }
}

if (broken.length > 0) {
  const lines = broken.map(({ file, target }) => `  ${file} → ${target}`);
  throw new Error(
    `문서에 존재하지 않는 경로를 가리키는 링크가 ${broken.length}건 있습니다.\n` +
      `${lines.join("\n")}\n` +
      "파일을 옮겼다면 링크를, 링크가 틀렸다면 링크를 고치세요."
  );
}

console.info(`문서 링크 검증 완료 — ${files.length}개 파일에서 상대 링크 ${checked}건 확인`);
