export const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
export const DEFAULT_OLLAMA_TEMPERATURE = 0.7;

export const OLLAMA_MODELS = {
  gemma2: "gemma2:9b",
  qwen25Coder: "qwen2.5-coder:7b",
  nomicEmbedText: "nomic-embed-text",
} as const;

export type OllamaModelName = (typeof OLLAMA_MODELS)[keyof typeof OLLAMA_MODELS];

export const DEFAULT_OLLAMA_MODEL = OLLAMA_MODELS.gemma2;

export const OLLAMA_KEEP_ALIVE_UNLOAD = 0;

export const REVIEW_PIPELINE_MODELS = {
  analyzer: OLLAMA_MODELS.qwen25Coder,
  reporter: OLLAMA_MODELS.gemma2,
} as const;

export const CHAT_ORCHESTRATION_MODELS = {
  planner: OLLAMA_MODELS.qwen25Coder,
  worker: OLLAMA_MODELS.gemma2,
} as const;

export const OLLAMA_MODEL_OPTIONS = Object.values(OLLAMA_MODELS);

export const MESSAGE_ROLE = {
  system: "system",
  user: "user",
  assistant: "assistant",
} as const;

export function isAllowedOllamaModel(value: unknown): value is OllamaModelName {
  return (
    typeof value === "string" &&
    (OLLAMA_MODEL_OPTIONS as readonly string[]).includes(value)
  );
}

export function isOllamaModelInstalled(
  installedModels: string[],
  model: string,
): boolean {
  return installedModels.some((installed) => {
    if (installed === model) return true;
    if (model.includes(":")) return false;
    return installed === `${model}:latest` || installed.startsWith(`${model}:`);
  });
}

export function missingReviewPipelineModels(installedModels: string[]): string[] {
  return [
    REVIEW_PIPELINE_MODELS.analyzer,
    REVIEW_PIPELINE_MODELS.reporter,
  ].filter((model) => !isOllamaModelInstalled(installedModels, model));
}
