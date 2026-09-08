import { createHash } from "node:crypto";

export function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function normalizeFailMessage(message: string): string {
  return message
    .replace(/:\d+(?::\d+)?/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function computeErrorHash(
  failMessage: string,
  stackExcerpt: string,
): string {
  const normalized = `${normalizeFailMessage(failMessage)}\n${normalizeFailMessage(stackExcerpt)}`;
  return hashText(normalized);
}
