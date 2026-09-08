import path from "node:path";
import { TASK_ID_PATTERN } from "@/constants/agent";

export function toKebabCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();
}

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

export function filenameToTaskId(filename: string): string {
  const slug = path.posix
    .basename(filename, path.posix.extname(filename))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  return TASK_ID_PATTERN.test(slug) ? slug : `task-${Date.now()}`;
}

export function toSiblingTestPath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/");
  if (/\.(test|spec)\.tsx?$/.test(normalized)) return normalized;
  return normalized.replace(/(\.tsx?)$/, ".test$1");
}

export function sandboxImplPath(filename: string): string {
  return `src/${path.posix.basename(filename)}`;
}

export function sandboxTestPath(filename: string): string {
  return toSiblingTestPath(sandboxImplPath(filename));
}
