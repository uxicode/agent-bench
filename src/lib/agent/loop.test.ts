import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AGENT_ACTION, AGENT_SOURCE_KIND, AGENT_STATUS } from "@/constants/agent";
import { MODEL_RUN_TIMEOUT_MESSAGE } from "@/constants/timeout";
import { runAgentLoop } from "@/lib/agent/loop";
import type { ReviewPipelineResult } from "@/types/agent";

const TASK_ID = "unit-loop";
const ADD_CODE = "export function add(a: number, b: number) { return a + b; }";

const REVIEW: ReviewPipelineResult = {
  analysis: {
    summary: "단순 덧셈 함수",
    findings: [],
    risks: [],
    suggestions: ["테스트 추가"],
  },
  report: "## 결론\n문제 없습니다.",
};

let tempDir = "";

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = "";
  }
});

describe("runAgentLoop", () => {
  it("코드리뷰 파이프라인이 리포트를 반환한다", async () => {
    const result = await runAgentLoop(
      {
        action: AGENT_ACTION.review,
        sourceKind: AGENT_SOURCE_KIND.code,
        code: ADD_CODE,
        taskId: TASK_ID,
      },
      { runReview: async () => REVIEW },
    );

    expect(result.status).toBe(AGENT_STATUS.succeeded);
    expect(result.attempts).toBe(2);
    expect(result.report).toBe(REVIEW.report);
    expect(result.analysis).toEqual(REVIEW.analysis);
    expect(
      result.timeline.some((event) => event.status === AGENT_STATUS.loadingSource),
    ).toBe(true);
    expect(
      result.timeline.some((event) => event.status === AGENT_STATUS.succeeded),
    ).toBe(true);
  });

  it("단계가 바뀔 때마다 onEvent를 호출한다", async () => {
    const events: string[] = [];
    await runAgentLoop(
      {
        action: AGENT_ACTION.review,
        sourceKind: AGENT_SOURCE_KIND.code,
        code: ADD_CODE,
        taskId: `${TASK_ID}-events`,
      },
      {
        runReview: async () => REVIEW,
        onEvent(event) {
          events.push(event.status);
        },
      },
    );

    expect(events).toEqual([AGENT_STATUS.loadingSource, AGENT_STATUS.succeeded]);
  });

  it("경로 모드에서 파일을 읽어 리뷰한다", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "agent-review-"));
    const filePath = path.join(tempDir, "add.ts");
    await writeFile(filePath, ADD_CODE, "utf8");

    let received = "";
    const result = await runAgentLoop(
      {
        action: AGENT_ACTION.review,
        sourceKind: AGENT_SOURCE_KIND.path,
        path: filePath,
        taskId: `${TASK_ID}-path`,
      },
      {
        runReview: async (input) => {
          received = input.sourceCode;
          expect(input.filename).toBe("add.ts");
          return REVIEW;
        },
      },
    );

    expect(result.status).toBe(AGENT_STATUS.succeeded);
    expect(received).toBe(ADD_CODE);
  });

  it("이미 abort된 시그널이면 모델 호출 없이 중단한다", async () => {
    let called = false;
    const result = await runAgentLoop(
      {
        action: AGENT_ACTION.review,
        sourceKind: AGENT_SOURCE_KIND.code,
        code: ADD_CODE,
        taskId: `${TASK_ID}-timeout`,
        signal: AbortSignal.abort(),
      },
      {
        runReview: async () => {
          called = true;
          return REVIEW;
        },
      },
    );

    expect(called).toBe(false);
    expect(result.status).toBe(AGENT_STATUS.failedInfra);
    expect(result.attempts).toBe(0);
    expect(result.errorMessage).toBe(MODEL_RUN_TIMEOUT_MESSAGE);
  });
});
