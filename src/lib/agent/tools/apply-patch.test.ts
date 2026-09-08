import { afterEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { applyPatch } from "@/lib/agent/tools/apply-patch";
import { listFiles } from "@/lib/agent/tools/list-files";
import { readFile } from "@/lib/agent/tools/read-file";
import { createTestLock } from "@/lib/agent/test-lock";
import { getSandboxTaskDir } from "@/lib/agent/guards";

const TASK_ID = "unit-apply-patch";

afterEach(async () => {
  await rm(getSandboxTaskDir(TASK_ID), { recursive: true, force: true });
});

describe("applyPatch", () => {
  it("src/app 경로 패치를 거부한다", async () => {
    await expect(
      applyPatch(TASK_ID, {
        files: [
          {
            path: "src/app/api/chat/route.ts",
            content: "export {}",
          },
        ],
      }),
    ).rejects.toThrow(/앱 소스/);
  });

  it("잠긴 테스트 파일은 디스크에 쓰지 않는다", async () => {
    await applyPatch(TASK_ID, {
      files: [
        { path: "src/example.test.ts", content: "expect(1).toBe(1)" },
        { path: "src/example.ts", content: "export const n = 1" },
      ],
    });
    const lock = createTestLock([
      { path: "src/example.test.ts", content: "expect(1).toBe(1)" },
    ]);

    const result = await applyPatch(
      TASK_ID,
      {
        files: [
          { path: "src/example.test.ts", content: "expect(true).toBe(true)" },
        ],
      },
      lock,
    );

    expect(result.rejectedReason).toMatch(/lock/);
    const file = await readFile(TASK_ID, "src/example.test.ts");
    expect(file.content).toBe("expect(1).toBe(1)");
  });

  it("파일 4개를 쓰려 하면 거부한다", async () => {
    const result = await applyPatch(TASK_ID, {
      files: [
        { path: "src/a.ts", content: "a" },
        { path: "src/b.ts", content: "b" },
        { path: "src/c.ts", content: "c" },
        { path: "src/d.ts", content: "d" },
      ],
    });

    expect(result.rejectedReason).toBe("max-files");
    expect(await listFiles(TASK_ID)).toEqual([]);
  });
});
