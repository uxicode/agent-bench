import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { MESSAGE_ROLE } from "@/constants/ollama";
import type { ChatMessage } from "@/types/chat";

export function toLangChainMessages(messages: ChatMessage[]) {
  return messages.map((message) => {
    if (message.role === MESSAGE_ROLE.system)
      return new SystemMessage(message.content);

    if (message.role === MESSAGE_ROLE.assistant)
      return new AIMessage(message.content);

    return new HumanMessage(message.content);
  });
}

export function getChunkText(content: unknown) {
  if (typeof content === "string") return content;

  if (!Array.isArray(content)) return "";

  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part)
        return String(part.text ?? "");
      return "";
    })
    .join("");
}
