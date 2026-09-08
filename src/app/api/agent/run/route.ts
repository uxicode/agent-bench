import {
  AGENT_STATUS,
  isAgentAction,
  isAgentSourceKind,
} from "@/constants/agent";
import { OLLAMA_MODELS, isOllamaModelInstalled } from "@/constants/ollama";
import { resolveAgentTaskId, runAgentLoop } from "@/lib/agent/loop";
import { releaseRunLock, tryAcquireRunLock } from "@/lib/agent/run-lock";
import { getOllamaConfig } from "@/lib/ollama/config";
import type { AgentRunRequest } from "@/types/agent";

export const maxDuration = 300;

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

  if (!isAgentAction(body.action))
    return Response.json(
      { error: "action은 test, optimize, refactor 중 하나여야 합니다." },
      { status: 400 },
    );

  if (!isAgentSourceKind(body.sourceKind))
    return Response.json(
      { error: "sourceKind는 code 또는 path여야 합니다." },
      { status: 400 },
    );

  const code = typeof body.code === "string" ? body.code.trim() : "";
  const sourcePath = typeof body.path === "string" ? body.path.trim() : "";
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
  });

  if (!tryAcquireRunLock())
    return Response.json({ error: "이미 실행 중입니다." }, { status: 409 });

  try {
    const coderReady = await isCoderModelReady();
    if (!coderReady)
      return Response.json(
        {
          error: `모델 "${OLLAMA_MODELS.qwen25Coder}"이(가) 없습니다. ollama pull ${OLLAMA_MODELS.qwen25Coder}`,
          status: AGENT_STATUS.failedInfra,
        },
        { status: 503 },
      );

    const result = await runAgentLoop({
      action: body.action,
      sourceKind: body.sourceKind,
      code: body.sourceKind === "code" ? code : undefined,
      path: body.sourceKind === "path" ? sourcePath : undefined,
      instruction,
      taskId,
    });
    return Response.json(result);
  } catch (error) {
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
  } finally {
    releaseRunLock();
  }
}

async function isCoderModelReady(): Promise<boolean> {
  const { baseUrl } = getOllamaConfig();

  try {
    const response = await fetch(`${baseUrl}/api/tags`, { cache: "no-store" });
    if (!response.ok) return false;
    const data = (await response.json()) as OllamaTagsResponse;
    const models = (data.models ?? [])
      .map((item) => item.name ?? "")
      .filter(Boolean);
    return isOllamaModelInstalled(models, OLLAMA_MODELS.qwen25Coder);
  } catch {
    return false;
  }
}
