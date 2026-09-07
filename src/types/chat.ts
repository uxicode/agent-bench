import { MESSAGE_ROLE } from "@/constants/ollama";

export type MessageRole = (typeof MESSAGE_ROLE)[keyof typeof MESSAGE_ROLE];

export interface ChatMessage {
  role: MessageRole;
  content: string;
}

export interface ChatRequestBody {
  messages: ChatMessage[];
}

export interface OllamaHealth {
  isReady: boolean;
  hasError: boolean;
  baseUrl: string;
  model: string;
  models: string[];
  errorMessage?: string;
}
