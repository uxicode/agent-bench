export const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
export const DEFAULT_OLLAMA_MODEL = "gemma2:9b";
export const DEFAULT_OLLAMA_TEMPERATURE = 0.7;

export const MESSAGE_ROLE = {
  system: "system",
  user: "user",
  assistant: "assistant",
} as const;
