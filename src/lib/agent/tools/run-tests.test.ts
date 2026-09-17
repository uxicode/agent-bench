import { afterEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { getSandboxTaskDir } from "@/lib/agent/guards";
import { applyPatch } from "@/lib/agent/tools/apply-patch";
import { runTests } from "@/lib/agent/tools/run-tests";

const TASK_ID = "unit-run-tests";

afterEach(async () => {
  await rm(getSandboxTaskDir(TASK_ID), { recursive: true, force: true });
});

describe("runTests", () => {
  it("임의 커맨드 문자열을 거부한다", async () => {
    await expect(
      runTests("parse-query", "rm -rf /" as never),
    ).rejects.toThrow(/허용되지 않은 테스트 명령/);
  });

  it("import 없이 vi를 쓰는 테스트를 실행한다", async () => {
    await applyPatch(TASK_ID, {
      files: [
        {
          path: "src/example.ts",
          content: "export const n = 1;\n",
        },
        {
          path: "src/example.test.ts",
          content: `describe("example", () => {
  it("uses vi", () => {
    const fn = vi.fn(() => 1);
    expect(fn()).toBe(1);
  });
});
`,
        },
      ],
    });

    const result = await runTests(TASK_ID);
    expect(result.ok).toBe(true);
  });
});
