import {
  DEFAULT_OLLAMA_BASE_URL,
  DEFAULT_OLLAMA_MODEL,
  DEFAULT_OLLAMA_TEMPERATURE,
} from "@/constants/ollama";

export interface OllamaRuntimeConfig {
  baseUrl: string;
  model: string;
  temperature: number;
}

export function getOllamaConfig(): OllamaRuntimeConfig {
  return {
    baseUrl: process.env.OLLAMA_BASE_URL ?? DEFAULT_OLLAMA_BASE_URL,
    model: process.env.OLLAMA_MODEL ?? DEFAULT_OLLAMA_MODEL,
    temperature: Number(
      process.env.OLLAMA_TEMPERATURE ?? DEFAULT_OLLAMA_TEMPERATURE,
    ),
  };
}
