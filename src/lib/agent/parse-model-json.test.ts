import { describe, expect, it } from "vitest";
import { parseModelPatch } from "@/lib/agent/parse-model-json";

describe("parse-model-json", () => {
  it("코드펜스 안의 JSON을 파싱한다", () => {
    const payload = parseModelPatch(
      '설명\n```json\n{"files":[{"path":"src/a.ts","content":"export const a = 1"}]}\n```',
    );

    expect(payload.files).toEqual([
      { path: "src/a.ts", content: "export const a = 1" },
    ]);
  });

  it("files가 없으면 실패한다", () => {
    expect(() => parseModelPatch('{"ok":true}')).toThrow(/files/);
  });

  it("단일 {path,content} 객체도 받는다", () => {
    const payload = parseModelPatch(
      '{"path":"src/a.ts","content":"export const a = 1"}',
    );
    expect(payload.files).toEqual([
      { path: "src/a.ts", content: "export const a = 1" },
    ]);
  });
});
