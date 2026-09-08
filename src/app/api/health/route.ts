import { NextResponse } from "next/server";
import { getOllamaConfig } from "@/lib/ollama/config";
import type { OllamaHealth } from "@/types/chat";

interface OllamaTag {
  name?: string;
}

interface OllamaTagsResponse {
  models?: OllamaTag[];
}

export async function GET() {
  const { baseUrl, model } = getOllamaConfig();

  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      cache: "no-store",
    });

    if (!response.ok) {
      const payload: OllamaHealth = {
        isReady: false,
        hasError: true,
        baseUrl,
        model,
        models: [],
        errorMessage: `Ollama 응답 오류 (${response.status})`,
      };

      return NextResponse.json(payload, { status: 502 });
    }

    const data = (await response.json()) as OllamaTagsResponse;
    const models = (data.models ?? [])
      .map((item) => item.name ?? "")
      .filter(Boolean);

    const payload: OllamaHealth = {
      isReady: true,
      hasError: false,
      baseUrl,
      model,
      models,
    };

    return NextResponse.json(payload);
  } catch {
    const payload: OllamaHealth = {
      isReady: false,
      hasError: true,
      baseUrl,
      model,
      models: [],
      errorMessage: "Ollama 서버에 연결할 수 없습니다. ollama serve 상태를 확인하세요.",
    };

    return NextResponse.json(payload, { status: 503 });
  }
}
