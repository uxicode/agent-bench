import { ChatOllama } from "@langchain/ollama";
import {
  getOllamaConfig,
  type OllamaRuntimeConfig,
} from "@/lib/ollama/config";
import { abortableFetch } from "@/lib/ollama/timeout";

export interface CreateChatOllamaOptions
  extends Partial<Pick<OllamaRuntimeConfig, "model" | "temperature">> {
  keepAlive?: string | number;
}

export function createChatOllama(
  overrides?: CreateChatOllamaOptions,
  signal?: AbortSignal,
) {
  const config = getOllamaConfig();

  return new ChatOllama({
    model: overrides?.model ?? config.model,
    baseUrl: config.baseUrl,
    temperature: overrides?.temperature ?? config.temperature,
    keepAlive: overrides?.keepAlive,
    fetch: signal ? abortableFetch(signal) : undefined,
  });
}
