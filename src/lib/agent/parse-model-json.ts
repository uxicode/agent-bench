import type { AgentPatchPayload } from "@/types/agent";

export function parseModelPatch(text: string): AgentPatchPayload {
  const raw = extractJsonObject(text);
  const parsed = JSON.parse(raw) as unknown;
  const files = normalizeFiles(parsed);

  if (files.length === 0)
    throw new Error("패치 JSON에 files 배열이 없습니다.");

  return { files };
}

function normalizeFiles(parsed: unknown): AgentPatchPayload["files"] {
  if (Array.isArray(parsed)) return parsed.map(toFilePatch);

  if (!parsed || typeof parsed !== "object")
    throw new Error("패치 JSON에 files 배열이 없습니다.");

  const record = parsed as {
    files?: unknown;
    path?: unknown;
    content?: unknown;
  };

  if (Array.isArray(record.files)) return record.files.map(toFilePatch);
  if (typeof record.path === "string" && typeof record.content === "string")
    return [toFilePatch(record)];

  throw new Error("패치 JSON에 files 배열이 없습니다.");
}

function toFilePatch(file: unknown): AgentPatchPayload["files"][number] {
  if (!file || typeof file !== "object")
    throw new Error("files 항목이 올바르지 않습니다.");

  const item = file as { path?: unknown; content?: unknown };
  if (typeof item.path !== "string" || item.path.trim().length === 0)
    throw new Error("files.path가 필요합니다.");
  if (typeof item.content !== "string")
    throw new Error("files.content가 필요합니다.");

  return { path: item.path, content: item.content };
}

export function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced?.[1] ?? trimmed).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start)
    throw new Error("JSON 객체를 찾지 못했습니다.");

  return body.slice(start, end + 1);
}
