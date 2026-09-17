import { describe, expect, it } from "vitest";
import { DEFAULT_OLLAMA_BASE_URL, OLLAMA_KEEP_ALIVE_UNLOAD } from "@/constants/ollama";
import { unloadOllamaModel } from "@/lib/ollama/unload";

describe("unloadOllamaModel", () => {
  it("keep_alive: 0으로 generate 요청을 보낸다", async () => {
    let url = "";
    let body = "";

    await unloadOllamaModel("qwen2.5-coder:7b", {
      fetchFn: async (input, init) => {
        url = String(input);
        body = String(init?.body ?? "");
        return new Response("{}", { status: 200 });
      },
    });

    expect(url).toBe(`${DEFAULT_OLLAMA_BASE_URL}/api/generate`);
    expect(JSON.parse(body)).toMatchObject({
      model: "qwen2.5-coder:7b",
      keep_alive: OLLAMA_KEEP_ALIVE_UNLOAD,
      prompt: "",
      stream: false,
    });
  });
});
