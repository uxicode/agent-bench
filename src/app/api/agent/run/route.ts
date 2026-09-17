import { AGENT_ACTION, AGENT_STATUS, isAgentAction, isAgentSourceKind } from "@/constants/agent";
import { missingReviewPipelineModels } from "@/constants/ollama";
import { resolveAgentTaskId, runAgentLoop } from "@/lib/agent/loop";
import { releaseRunLock, tryAcquireRunLock } from "@/lib/agent/run-lock";
import { encodeAgentStreamEvent } from "@/lib/agent/run-stream";
import { getOllamaConfig } from "@/lib/ollama/config";
import {
  MODEL_RUN_TIMEOUT_MESSAGE,
  MODEL_RUN_TIMEOUT_MS,
} from "@/constants/timeout";
import { createDeadlineSignal, isDeadlineAbort } from "@/lib/ollama/timeout";
import { AGENT_STREAM_EVENT, type AgentRunRequest, type AgentRunStreamEvent } from "@/types/agent";

export const maxDuration = 120;

interface OllamaTagsResponse {
  models?: { name?: string }[];
}

export async function POST(request: Request) {
  let body: AgentRunRequest;

  try {
    body = (await request.json()) as AgentRunRequest;
  } catch {
    return Response.json(
      { error: "요청 본문이 올바른 JSON이 아닙니다." },
      { status: 400 },
    );
  }

  const action = body.action ?? AGENT_ACTION.review;
  if (!isAgentAction(action))
    return Response.json(
      { error: "action은 review여야 합니다." },
      { status: 400 },
    );

  if (!isAgentSourceKind(body.sourceKind))
    return Response.json(
      { error: "sourceKind는 code 또는 path여야 합니다." },
      { status: 400 },
    );

  const code = typeof body.code === "string" ? body.code.trim() : "";
  const sourcePath = typeof body.path === "string" ? body.path.trim() : "";
  const filename =
    typeof body.filename === "string" ? body.filename.trim() : undefined;
  const instruction =
    typeof body.instruction === "string" ? body.instruction.trim() : undefined;

  if (body.sourceKind === "code" && !code)
    return Response.json({ error: "코드를 입력하세요." }, { status: 400 });

  if (body.sourceKind === "path" && !sourcePath)
    return Response.json({ error: "파일 경로를 입력하세요." }, { status: 400 });

  const taskId = resolveAgentTaskId({
    taskId: typeof body.taskId === "string" ? body.taskId : undefined,
    sourceKind: body.sourceKind,
    code,
    path: sourcePath,
    filename,
  });

  if (!tryAcquireRunLock())
    return Response.json({ error: "이미 실행 중입니다." }, { status: 409 });

  const { baseUrl } = getOllamaConfig();

  try {
    const missing = await getMissingPipelineModels();
    if (missing.length > 0) {
      releaseRunLock();
      return Response.json(
        {
          error: `모델 "${missing.join(", ")}"이(가) 없습니다. ollama pull ${missing.join(" && ollama pull ")}`,
          status: AGENT_STATUS.failedInfra,
        },
        { status: 503 },
      );
    }
  } catch (error) {
    releaseRunLock();
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "에이전트 실행에 실패했습니다.",
        status: AGENT_STATUS.failedInfra,
      },
      { status: 500 },
    );
  }

  const signal = createDeadlineSignal(MODEL_RUN_TIMEOUT_MS, request.signal);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: AgentRunStreamEvent) {
        controller.enqueue(encoder.encode(encodeAgentStreamEvent(event)));
      }

      try {
        send({
          type: AGENT_STREAM_EVENT.connection,
          state: "streaming",
          message: `Ollama에 연결했습니다. ${baseUrl}`,
          ollamaBaseUrl: baseUrl,
        });

        const result = await runAgentLoop(
          {
            action,
            sourceKind: body.sourceKind,
            code: body.sourceKind === "code" ? code : undefined,
            path: body.sourceKind === "path" ? sourcePath : undefined,
            filename: body.sourceKind === "code" ? filename : undefined,
            instruction,
            taskId,
            signal,
          },
          {
            onEvent(event) {
              send({ type: AGENT_STREAM_EVENT.log, event });
            },
          },
        );

        send({
          type: AGENT_STREAM_EVENT.connection,
          state: result.status === AGENT_STATUS.succeeded ? "completed" : "failed",
          message:
            result.status === AGENT_STATUS.succeeded
              ? "파이프라인이 끝났습니다."
              : (result.errorMessage ?? "파이프라인이 실패했습니다."),
          ollamaBaseUrl: baseUrl,
        });
        send({ type: AGENT_STREAM_EVENT.result, result });
      } catch (error) {
        const message = isDeadlineAbort(error)
          ? MODEL_RUN_TIMEOUT_MESSAGE
          : error instanceof Error
            ? error.message
            : "에이전트 실행에 실패했습니다.";
        send({
          type: AGENT_STREAM_EVENT.connection,
          state: "failed",
          message,
          ollamaBaseUrl: baseUrl,
        });
        send({ type: AGENT_STREAM_EVENT.error, error: message });
      } finally {
        releaseRunLock();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

async function getMissingPipelineModels(): Promise<string[]> {
  const { baseUrl } = getOllamaConfig();

  try {
    const response = await fetch(`${baseUrl}/api/tags`, { cache: "no-store" });
    if (!response.ok) return missingReviewPipelineModels([]);
    const data = (await response.json()) as OllamaTagsResponse;
    const models = (data.models ?? [])
      .map((item) => item.name ?? "")
      .filter(Boolean);
    return missingReviewPipelineModels(models);
  } catch {
    return missingReviewPipelineModels([]);
  }
}
