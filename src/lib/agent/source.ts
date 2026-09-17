import path from "node:path";
import { TASK_ID_PATTERN } from "@/constants/agent";

export function toKebabCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();
}

const SOURCE_FILENAME_PATTERN = /^[A-Za-z0-9._-]+\.(tsx?|jsx?|mjs|cjs)$/;

export function inferFilename(code: string): string {
  const functionMatch = code.match(
    /export\s+(?:async\s+)?function\s+([A-Za-z_][\w]*)/,
  );
  if (functionMatch) return `${toKebabCase(functionMatch[1])}.ts`;

  const classMatch = code.match(/export\s+class\s+([A-Za-z_][\w]*)/);
  if (classMatch) return `${toKebabCase(classMatch[1])}.ts`;

  const constMatch = code.match(/export\s+const\s+([A-Za-z_][\w]*)\s*=/);
  if (constMatch) return `${toKebabCase(constMatch[1])}.ts`;

  return "target.ts";
}

export function resolveSourceFilename(
  filename?: string,
  code?: string,
): string {
  const base = filename
    ? path.posix.basename(filename.replace(/\\/g, "/"))
    : "";
  if (SOURCE_FILENAME_PATTERN.test(base)) return base;
  return inferFilename(code ?? "");
}

export function constrainPatchToPath(
  files: { path: string; content: string }[],
  allowedPath: string,
): { path: string; content: string }[] {
  if (files.length === 0) return [];
  const matched = files.find(
    (file) => normalizePatchPath(file.path) === normalizePatchPath(allowedPath),
  );
  const chosen = matched ?? files[0];
  return [{ path: allowedPath, content: chosen.content }];
}

function normalizePatchPath(inputPath: string): string {
  return inputPath.replace(/\\/g, "/").replace(/^\.\//, "");
}

export function filenameToTaskId(filename: string): string {
  const posixName = filename.replace(/\\/g, "/");
  const slug = path.posix
    .basename(posixName, path.posix.extname(posixName))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  return TASK_ID_PATTERN.test(slug) ? slug : `task-${Date.now()}`;
}

export function toSiblingTestPath(inputPath: string): string {
  const normalized = inputPath.replace(/\\/g, "/");
  if (/\.(test|spec)\.tsx?$/.test(normalized))
    return inputPath.includes("\\") ? normalized.replace(/\//g, "\\") : normalized;
  const replaced = normalized.replace(/(\.tsx?)$/, ".test$1");
  if (inputPath.includes("\\") && !inputPath.includes("/"))
    return replaced.replace(/\//g, "\\");
  return replaced;
}

export function sandboxImplPath(filename: string): string {
  return `src/${path.posix.basename(filename.replace(/\\/g, "/"))}`;
}

export function sandboxTestPath(filename: string): string {
  return toSiblingTestPath(sandboxImplPath(filename));
}
