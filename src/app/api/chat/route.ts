import { createChatOllama } from "@/lib/ollama/client";
import { getChunkText, toLangChainMessages } from "@/lib/ollama/messages";
import { MESSAGE_ROLE } from "@/constants/ollama";
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

  const model = createChatOllama();
  const stream = await model.stream(toLangChainMessages(messages));
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = getChunkText(chunk.content);
          if (text) controller.enqueue(encoder.encode(text));
        }
        controller.close();
      } catch (error) {
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
}
