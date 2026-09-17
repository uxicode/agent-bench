import { describe, expect, it } from "vitest";
import { REVIEW_PIPELINE_MODELS } from "@/constants/ollama";
import {
  createReviewPipeline,
  parseAnalysisNotes,
} from "@/lib/agent/review-pipeline";

const SOURCE = {
  filename: "add.ts",
  sourceCode: "export function add(a: number, b: number) { return a + b; }",
};

describe("createReviewPipeline", () => {
  it("분석 → 언로드 → 리포트 순서로 실행한다", async () => {
    const order: string[] = [];
    const pipeline = createReviewPipeline({
      deps: {
        analyzer: {
          async invoke() {
            order.push("analyze");
            return JSON.stringify({
              summary: "덧셈",
              findings: [
                {
                  severity: "low",
                  title: "테스트 없음",
                  detail: "단위 테스트가 없습니다.",
                },
              ],
              risks: [],
              suggestions: ["테스트 추가"],
            });
          },
        },
        reporter: {
          async invoke(messages) {
            order.push("report");
            expect(messages[1]?.content).toContain("덧셈");
            return "## 결론\n테스트가 필요합니다.";
          },
        },
        async unloadModel(model) {
          order.push("unload");
          expect(model).toBe(REVIEW_PIPELINE_MODELS.analyzer);
        },
      },
    });

    const result = await pipeline.invoke(SOURCE);

    expect(order).toEqual(["analyze", "unload", "report"]);
    expect(result.analysis.summary).toBe("덧셈");
    expect(result.report).toContain("테스트가 필요합니다");
  });

  it("분석 JSON이 아니면 원문을 요약으로 넘긴다", () => {
    const notes = parseAnalysisNotes("모델이 그냥 설명만 했습니다.");
    expect(notes.summary).toBe("모델이 그냥 설명만 했습니다.");
    expect(notes.findings).toEqual([]);
  });
});
