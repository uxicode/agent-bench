import { afterEach, describe, expect, it } from "vitest";
import { writeFile, rm } from "node:fs/promises";
import { AGENT_ACTION, AGENT_SOURCE_KIND, AGENT_STATUS } from "@/constants/agent";
import { getSandboxTaskDir, resolveSandboxPath } from "@/lib/agent/guards";
import { runAgentLoop } from "@/lib/agent/loop";
import type { AgentModelClient } from "@/types/agent";

const TASK_ID = "unit-loop";

afterEach(async () => {
  await rm(getSandboxTaskDir(TASK_ID), { recursive: true, force: true });
  await rm(getSandboxTaskDir(`${TASK_ID}-policy`), {
    recursive: true,
    force: true,
  });
});

function jsonFiles(files: { path: string; content: string }[]): string {
  return JSON.stringify({ files });
}

const ADD_CODE = "export function add(a: number, b: number) { return a + b; }";

describe("runAgentLoop", () => {
  it("붙여넣은 코드에 테스트를 쓰면 성공한다", async () => {
    const replies = [
      jsonFiles([
        {
          path: "src/add.test.ts",
          content: `import { describe, expect, it } from "vitest";
import { add } from "./add";
describe("add", () => {
  it("sums", () => expect(add(1, 2)).toBe(3));
});`,
        },
      ]),
    ];
    const modelClient: AgentModelClient = {
      async invoke() {
        return replies.shift() ?? "{}";
      },
    };

    const result = await runAgentLoop(
      {
        action: AGENT_ACTION.test,
        sourceKind: AGENT_SOURCE_KIND.code,
        code: ADD_CODE,
        taskId: TASK_ID,
        maxAttempts: 2,
      },
      { modelClient },
    );

    expect(result.status).toBe(AGENT_STATUS.succeeded);
    expect(result.attempts).toBe(1);
  });

  it("잠긴 테스트 해시가 바뀌면 FailedPolicy가 된다", async () => {
    const taskId = `${TASK_ID}-policy`;
    const replies = [
      jsonFiles([{ path: "src/add.test.ts", content: "expect(1).toBe(1)" }]),
      jsonFiles([{ path: "src/add.ts", content: "export const add = () => 1" }]),
      jsonFiles([{ path: "src/add.ts", content: "export const add = () => 2" }]),
    ];
    const modelClient: AgentModelClient = {
      async invoke() {
        return replies.shift() ?? jsonFiles([]);
      },
    };

    const result = await runAgentLoop(
      {
        action: AGENT_ACTION.optimize,
        sourceKind: AGENT_SOURCE_KIND.code,
        code: ADD_CODE,
        taskId,
        maxAttempts: 2,
      },
      {
        modelClient,
        runTestsFn: async () => {
          await writeFile(
            resolveSandboxPath(taskId, "src/add.test.ts"),
            "tampered",
            "utf8",
          );
          return {
            ok: false,
            stdoutExcerpt: "FAIL",
            failMessage: "fail",
            stackExcerpt: "at x",
          };
        },
      },
    );

    expect(result.status).toBe(AGENT_STATUS.failedPolicy);
  });
});
