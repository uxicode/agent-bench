import { createChatOllama } from "@/lib/ollama/client";
import { getChunkText, toLangChainMessages } from "@/lib/ollama/messages";
import {
  CHAT_ORCHESTRATION_MODELS,
  isAllowedOllamaModel,
  MESSAGE_ROLE,
} from "@/constants/ollama";
import {
  MODEL_RUN_TIMEOUT_MESSAGE,
  MODEL_RUN_TIMEOUT_MS,
} from "@/constants/timeout";
import { createChatOrchestration } from "@/lib/chat/orchestrate";
import {
  createDeadlineSignal,
  isDeadlineAbort,
} from "@/lib/ollama/timeout";
import type { ChatMessage, ChatRequestBody } from "@/types/chat";

export const maxDuration = 120;

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;

  const message = value as ChatMessage;
  const roles = Object.values(MESSAGE_ROLE);

  return (
    roles.includes(message.role) &&
    typeof message.content === "string" &&
    message.content.trim().length > 0
  );
}

export async function POST(request: Request) {
  let body: ChatRequestBody;

  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return Response.json(
      { error: "요청 본문이 올바른 JSON이 아닙니다." },
      { status: 400 },
    );
  }

  const messages = Array.isArray(body.messages)
    ? body.messages.filter(isChatMessage)
    : [];

  if (messages.length === 0) {
    return Response.json(
      { error: "messages 배열이 필요합니다." },
      { status: 400 },
    );
  }

  if (body.model !== undefined && !isAllowedOllamaModel(body.model)) {
    return Response.json(
      { error: "허용되지 않은 모델입니다." },
      { status: 400 },
    );
  }

  const workerModel = isAllowedOllamaModel(body.model)
    ? body.model
    : CHAT_ORCHESTRATION_MODELS.worker;
  const signal = createDeadlineSignal(MODEL_RUN_TIMEOUT_MS, request.signal);
  const orchestrator = createChatOrchestration({
    plannerModel: CHAT_ORCHESTRATION_MODELS.planner,
    workerModel,
    signal,
  });

  try {
    const planned = await orchestrator.invoke({ messages });
    const model = createChatOllama({ model: workerModel }, signal);
    const stream = await model.stream(
      toLangChainMessages(planned.answerMessages),
      { signal },
    );
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (signal.aborted) break;
            const text = getChunkText(chunk.content);
            if (text) controller.enqueue(encoder.encode(text));
          }

          if (signal.aborted)
            controller.enqueue(encoder.encode(`\n\n${MODEL_RUN_TIMEOUT_MESSAGE}`));

          controller.close();
        } catch (error) {
          if (isDeadlineAbort(error, signal)) {
            controller.enqueue(encoder.encode(`\n\n${MODEL_RUN_TIMEOUT_MESSAGE}`));
            controller.close();
            return;
          }
          controller.error(error);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (error) {
    if (isDeadlineAbort(error, signal))
      return Response.json(
        { error: MODEL_RUN_TIMEOUT_MESSAGE },
        { status: 504 },
      );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "채팅 요청에 실패했습니다.",
      },
      { status: 500 },
    );
  }
}
