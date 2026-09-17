import { describe, expect, it } from "vitest";
import {
  DIFF_LINE_KIND,
  countDiffChanges,
  diffLines,
} from "@/lib/agent/line-diff";

describe("diffLines", () => {
  it("같은 텍스트는 모두 유지 줄이다", () => {
    const lines = diffLines("a\nb", "a\nb");
    expect(lines.map((line) => line.kind)).toEqual([
      DIFF_LINE_KIND.equal,
      DIFF_LINE_KIND.equal,
    ]);
  });

  it("추가·삭제된 줄을 + / - 로 표시한다", () => {
    const lines = diffLines("keep\nold\n", "keep\nnew\n");
    expect(lines).toEqual([
      {
        kind: DIFF_LINE_KIND.equal,
        text: "keep",
        beforeNumber: 1,
        afterNumber: 1,
      },
      { kind: DIFF_LINE_KIND.remove, text: "old", beforeNumber: 2 },
      { kind: DIFF_LINE_KIND.add, text: "new", afterNumber: 2 },
      {
        kind: DIFF_LINE_KIND.equal,
        text: "",
        beforeNumber: 3,
        afterNumber: 3,
      },
    ]);
    expect(countDiffChanges(lines)).toEqual({ added: 1, removed: 1 });
  });
});
