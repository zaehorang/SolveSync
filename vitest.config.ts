import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // 하네스의 순수 로직(redaction 등)도 여기서 돈다. Playwright spec은
    // `*.spec.ts`라 잡히지 않는다.
    include: ["src/**/*.test.ts", "e2e/**/*.test.ts"],
    passWithNoTests: true
  }
});
