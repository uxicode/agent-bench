import { ChatOllama } from "@langchain/ollama";
import { getOllamaConfig } from "@/lib/ollama/config";

export function createChatOllama() {
  const { model, baseUrl, temperature } = getOllamaConfig();

  return new ChatOllama({
    model,
    baseUrl,
    temperature,
  });
}
