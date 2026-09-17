import { OLLAMA_KEEP_ALIVE_UNLOAD } from "@/constants/ollama";
import { getOllamaConfig } from "@/lib/ollama/config";

export async function unloadOllamaModel(
  model: string,
  options?: { signal?: AbortSignal; fetchFn?: typeof fetch },
): Promise<void> {
  const { baseUrl } = getOllamaConfig();
  const fetchFn = options?.fetchFn ?? fetch;
  const response = await fetchFn(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt: "",
      stream: false,
      keep_alive: OLLAMA_KEEP_ALIVE_UNLOAD,
    }),
    signal: options?.signal,
    cache: "no-store",
  });

  if (!response.ok)
    throw new Error(`모델 "${model}" 언로드에 실패했습니다.`);

  await response.text().catch(() => undefined);
}
