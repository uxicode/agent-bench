import type { ChatRoute } from "@/constants/chat";
import { MESSAGE_ROLE } from "@/constants/ollama";

export type MessageRole = (typeof MESSAGE_ROLE)[keyof typeof MESSAGE_ROLE];

export interface ChatMessage {
  role: MessageRole;
  content: string;
}

export interface ChatRequestBody {
  messages: ChatMessage[];
  model?: string;
}

export interface ChatSubQuestion {
  id: string;
  question: string;
}

export interface DecomposedChatQuestion {
  goal: string;
  subQuestions: ChatSubQuestion[];
}

export interface ChatWorkerAnswer {
  question: string;
  answer: string;
}

export interface ChatOrchestrateInput {
  messages: ChatMessage[];
}

export interface ChatOrchestrateResult {
  question: string;
  route: ChatRoute;
  decomposed?: DecomposedChatQuestion;
  workerAnswers?: ChatWorkerAnswer[];
  answerMessages: ChatMessage[];
}

export interface ChatModelClient {
  invoke(messages: ChatMessage[]): Promise<string>;
}

export interface ChatOrchestrateDeps {
  planner?: ChatModelClient;
  worker?: ChatModelClient;
  unloadPlanner?: (model: string) => Promise<void>;
}

export interface OllamaHealth {
  isReady: boolean;
  hasError: boolean;
  baseUrl: string;
  model: string;
  models: string[];
  errorMessage?: string;
}
