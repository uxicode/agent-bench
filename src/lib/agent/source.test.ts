import { describe, expect, it } from "vitest";
import {
  constrainPatchToPath,
  filenameToTaskId,
  resolveSourceFilename,
  sandboxImplPath,
  toSiblingTestPath,
} from "@/lib/agent/source";

describe("source paths", () => {
  it("절대 경로의 형제 테스트 경로를 만든다", () => {
    expect(toSiblingTestPath("/Users/me/proj/src/utils.ts")).toBe(
      "/Users/me/proj/src/utils.test.ts",
    );
  });

  it("Windows 절대 경로의 형제 테스트 경로를 만든다", () => {
    expect(toSiblingTestPath("C:\\proj\\src\\utils.ts")).toBe(
      "C:\\proj\\src\\utils.test.ts",
    );
  });

  it("첨부 파일명을 우선하고 잘못된 패치 경로는 대상 파일로 되돌린다", () => {
    expect(resolveSourceFilename("zip-generated-specs.ts", "export const x = 1")).toBe(
      "zip-generated-specs.ts",
    );
    expect(
      constrainPatchToPath(
        [{ path: "src/example.ts", content: "export const n = 1" }],
        "src/zip-generated-specs.ts",
      ),
    ).toEqual([
      { path: "src/zip-generated-specs.ts", content: "export const n = 1" },
    ]);
  });

  it("절대 경로에서 샌드박스 구현 파일명을 추출한다", () => {
    expect(sandboxImplPath("/Users/me/other/src/parse-query.ts")).toBe(
      "src/parse-query.ts",
    );
    expect(filenameToTaskId("/Users/me/other/src/parse-query.ts")).toBe(
      "parse-query",
    );
  });
});
