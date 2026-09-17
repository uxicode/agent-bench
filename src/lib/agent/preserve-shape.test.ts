import { describe, expect, it } from "vitest";
import {
  collectExportedNames,
  isDestructiveRewrite,
} from "@/lib/agent/preserve-shape";

describe("preserve-shape", () => {
  it("export 이름을 모은다", () => {
    expect(
      collectExportedNames(
        "export interface A {}\nexport function b() {}\nexport const c = 1;",
      ),
    ).toEqual(["b", "c", "A"]);
  });

  it("원본을 짧은 토이 예제로 바꾸면 파괴적이다", () => {
    const before = `import { randomUUID } from "node:crypto";
export interface CodegenParseResult { steps: string[] }
export function extractTestBody(script: string) { return script; }
export function codegenScriptToSteps(script: string) { return { steps: [], warnings: [] }; }
`;
    const after = `export function generateSteps(input: string): string[] {
  return input.split(" ").map((word) => word.toUpperCase());
}
`;
    expect(isDestructiveRewrite(before, after)).toBe(true);
  });

  it("같은 export를 유지한 정리 리팩터링은 허용한다", () => {
    const before =
      "export function add(a: number, b: number) { return a + b; }\n";
    const after =
      "export function add(a: number, b: number) {\n  return a + b;\n}\n";
    expect(isDestructiveRewrite(before, after)).toBe(false);
  });
});
