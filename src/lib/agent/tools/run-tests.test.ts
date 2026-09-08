import { describe, expect, it } from "vitest";
import { runTests } from "@/lib/agent/tools/run-tests";

describe("runTests", () => {
  it("임의 커맨드 문자열을 거부한다", async () => {
    await expect(
      runTests("parse-query", "rm -rf /" as never),
    ).rejects.toThrow(/허용되지 않은 테스트 명령/);
  });
});
