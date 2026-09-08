import { afterEach, describe, expect, it } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { AGENT_READ_FILE_MAX_BYTES } from "@/constants/agent";
import { getSandboxTaskDir } from "@/lib/agent/guards";
import { readFile } from "@/lib/agent/tools/read-file";

const TASK_ID = "unit-read-file";

afterEach(async () => {
  await rm(getSandboxTaskDir(TASK_ID), { recursive: true, force: true });
});

describe("readFile", () => {
  it("64KB를 넘는 파일을 거부한다", async () => {
    const dir = path.join(getSandboxTaskDir(TASK_ID), "src");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "big.ts"),
      "a".repeat(AGENT_READ_FILE_MAX_BYTES + 1),
      "utf8",
    );

    await expect(readFile(TASK_ID, "src/big.ts")).rejects.toThrow(/64KB/);
  });
});
