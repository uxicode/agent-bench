import { describe, expect, it } from "vitest";
import { computeErrorHash, normalizeFailMessage } from "@/lib/agent/error-hash";

describe("error-hash", () => {
  it("라인 번호만 다른 FAIL은 같은 해시가 된다", () => {
    const left = computeErrorHash(
      "FAIL src/parse-query.test.ts:12:3 expected 1",
      "    at Object.<anonymous> (src/parse-query.test.ts:12:3)",
    );
    const right = computeErrorHash(
      "FAIL src/parse-query.test.ts:40:8 expected 1",
      "    at Object.<anonymous> (src/parse-query.test.ts:40:8)",
    );

    expect(left).toBe(right);
  });

  it("메시지 본문이 다르면 해시가 달라진다", () => {
    const left = computeErrorHash("expected 1", "at run (file.ts:1:1)");
    const right = computeErrorHash("expected 2", "at run (file.ts:1:1)");

    expect(left).not.toBe(right);
  });

  it("공백과 대소문자를 정규화한다", () => {
    expect(normalizeFailMessage("  Expected 1  ")).toBe("expected 1");
  });
});
