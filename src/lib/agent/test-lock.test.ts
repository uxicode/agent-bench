import { describe, expect, it } from "vitest";
import { assertPatchRespectsLock, createTestLock } from "@/lib/agent/test-lock";

describe("test-lock", () => {
  it("잠긴 테스트 파일 패치를 거부한다", () => {
    const lock = createTestLock([
      {
        path: "src/parse-query.test.ts",
        content: "expect(parseQuery('')).toEqual({})",
      },
    ]);

    expect(() =>
      assertPatchRespectsLock(
        {
          files: [
            {
              path: "src/parse-query.test.ts",
              content: "expect(true).toBe(true)",
            },
          ],
        },
        lock,
      ),
    ).toThrow(/테스트 lock/);
  });

  it("구현 파일 패치는 허용한다", () => {
    const lock = createTestLock([
      { path: "src/parse-query.test.ts", content: "test" },
    ]);

    expect(() =>
      assertPatchRespectsLock(
        {
          files: [{ path: "src/parse-query.ts", content: "export function parseQuery() {}" }],
        },
        lock,
      ),
    ).not.toThrow();
  });
});
