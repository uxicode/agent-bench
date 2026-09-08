import { ChatOllama } from "@langchain/ollama";
import {
  getOllamaConfig,
  type OllamaRuntimeConfig,
} from "@/lib/ollama/config";

export function createChatOllama(
  overrides?: Partial<Pick<OllamaRuntimeConfig, "model" | "temperature">>,
) {
  const config = getOllamaConfig();

  return new ChatOllama({
    model: overrides?.model ?? config.model,
    baseUrl: config.baseUrl,
    temperature: overrides?.temperature ?? config.temperature,
  });
}
