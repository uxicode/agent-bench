import path from "node:path";
import { AGENT_ACTION, AGENT_STATUS, type AgentStatus } from "@/constants/agent";
import { REVIEW_PIPELINE_MODELS } from "@/constants/ollama";
import { MODEL_RUN_TIMEOUT_MESSAGE } from "@/constants/timeout";
import { createReviewPipeline } from "@/lib/agent/review-pipeline";
import { writeRunRecord } from "@/lib/agent/run-record";
import { filenameToTaskId, resolveSourceFilename } from "@/lib/agent/source";
import { readRepoFile } from "@/lib/agent/workspace";
import {
  ModelRunTimeoutError,
  isDeadlineAbort,
  throwIfAborted,
} from "@/lib/ollama/timeout";
import type {
  AgentLoopDeps,
  AgentLoopInput,
  AgentRunRecord,
  AgentRunResponse,
  AgentTimelineEvent,
  ReviewPipelineResult,
} from "@/types/agent";

export async function runAgentLoop(
  input: AgentLoopInput,
  deps?: AgentLoopDeps,
): Promise<AgentRunResponse> {
  const runId = `run-${Date.now()}`;
  const startedAt = new Date().toISOString();
  const timeline: AgentTimelineEvent[] = [];
  let attempts = 0;

  function addEvent(status: AgentStatus, message: string) {
    const event: AgentTimelineEvent = {
      status,
      at: new Date().toISOString(),
      message,
    };
    timeline.push(event);
    deps?.onEvent?.(event);
  }

  async function finish(
    status: AgentStatus,
    extra?: Partial<AgentRunResponse>,
  ): Promise<AgentRunResponse> {
    const response: AgentRunResponse = {
      runId,
      taskId: input.taskId,
      status,
      attempts,
      timeline,
      stdoutExcerpt: extra?.stdoutExcerpt ?? "",
      diff: extra?.diff ?? [],
      report: extra?.report,
      analysis: extra?.analysis,
      errorMessage: extra?.errorMessage,
    };
    const record: AgentRunRecord = {
      ...response,
      spec: buildBrief(input),
      action: input.action,
      sourceKind: input.sourceKind,
      sourcePath: input.path,
      startedAt,
      endedAt: new Date().toISOString(),
      errorHashes: [],
      lockedTestHashes: {},
    };
    await writeRunRecord(record).catch(() => undefined);
    return response;
  }

  try {
    throwIfAborted(input.signal);
    addEvent(AGENT_STATUS.loadingSource, "리뷰할 소스 코드를 읽습니다.");
    const source = await loadSource(input);

    const runReview =
      deps?.runReview ??
      (async (payload) => {
        const pipeline = createReviewPipeline({
          signal: input.signal,
          onStage(stage) {
            if (stage === "analyzing") {
              addEvent(
                AGENT_STATUS.analyzingCode,
                `${REVIEW_PIPELINE_MODELS.analyzer}로 기술 분석을 수행합니다.`,
              );
            } else if (stage === "unloading") {
              addEvent(
                AGENT_STATUS.unloadingModel,
                `${REVIEW_PIPELINE_MODELS.analyzer}를 keep_alive: 0으로 메모리에서 내립니다.`,
              );
            } else {
              addEvent(
                AGENT_STATUS.writingReport,
                `${REVIEW_PIPELINE_MODELS.reporter}로 최종 리포트를 작성합니다.`,
              );
            }
          },
        });
        return pipeline.invoke(payload);
      });

    const result: ReviewPipelineResult = await runReview(source);
    attempts = 2;
    addEvent(AGENT_STATUS.succeeded, "코드리뷰 리포트를 작성했습니다.");
    return finish(AGENT_STATUS.succeeded, {
      report: result.report,
      analysis: result.analysis,
    });
  } catch (error) {
    if (isDeadlineAbort(error, input.signal)) {
      const timeout = new ModelRunTimeoutError();
      addEvent(AGENT_STATUS.failedInfra, timeout.message);
      return finish(AGENT_STATUS.failedInfra, {
        errorMessage: MODEL_RUN_TIMEOUT_MESSAGE,
      });
    }
    const message =
      error instanceof Error ? error.message : "알 수 없는 인프라 오류";
    addEvent(AGENT_STATUS.failedInfra, message);
    return finish(AGENT_STATUS.failedInfra, { errorMessage: message });
  }
}

export function resolveAgentTaskId(input: {
  taskId?: string;
  sourceKind: "code" | "path";
  code?: string;
  path?: string;
  filename?: string;
}): string {
  if (input.taskId) return filenameToTaskId(input.taskId);
  if (input.sourceKind === "path" && input.path)
    return filenameToTaskId(input.path);
  if (input.filename || input.code)
    return filenameToTaskId(resolveSourceFilename(input.filename, input.code));
  return `task-${Date.now()}`;
}

async function loadSource(input: AgentLoopInput): Promise<{
  filename: string;
  sourceCode: string;
  instruction?: string;
}> {
  if (input.sourceKind === "path") {
    const sourcePath = input.path?.trim() ?? "";
    const sourceCode = await readRepoFile(sourcePath);
    return {
      filename: path.posix.basename(sourcePath.replace(/\\/g, "/")),
      sourceCode,
      instruction: input.instruction,
    };
  }

  const sourceCode = input.code?.trim() ?? "";
  if (!sourceCode) throw new Error("코드가 비어 있습니다.");
  return {
    filename: resolveSourceFilename(input.filename, sourceCode),
    sourceCode,
    instruction: input.instruction,
  };
}

function buildBrief(input: AgentLoopInput): string {
  const source =
    input.sourceKind === "path" ? input.path : (input.code ?? "").slice(0, 200);
  return [`action=${input.action ?? AGENT_ACTION.review}`, source, input.instruction]
    .filter(Boolean)
    .join("\n");
}
