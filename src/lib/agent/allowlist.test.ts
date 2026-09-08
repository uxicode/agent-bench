import { describe, expect, it } from "vitest";
import { isRunTestCommand, resolveRunTestsArgv } from "@/lib/agent/allowlist";
import { RUN_TEST_COMMAND } from "@/constants/agent";

describe("allowlist", () => {
  it("등록된 키만 허용한다", () => {
    expect(isRunTestCommand(RUN_TEST_COMMAND.vitest)).toBe(true);
    expect(isRunTestCommand("rm -rf /")).toBe(false);
    expect(isRunTestCommand("vitest && curl")).toBe(false);
  });

  it("vitest argv에 모델 문자열을 넣지 않고 taskId만 서버가 붙인다", () => {
    expect(resolveRunTestsArgv(RUN_TEST_COMMAND.vitest, "parse-query")).toEqual([
      "npx",
      "vitest",
      "run",
      "--config",
      "vitest.sandbox.config.ts",
      "sandbox/tasks/parse-query",
    ]);
  });
});
