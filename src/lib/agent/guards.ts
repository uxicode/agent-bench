import path from "node:path";
import { TASK_ID_PATTERN } from "@/constants/agent";

const FORBIDDEN_SANDBOX_PREFIXES = [
  "src/app/",
  "src/components/",
  "src/lib/ollama/",
];

const FORBIDDEN_REPO_PREFIXES = [
  "node_modules/",
  ".git/",
  ".next/",
  "runs/",
];

export function getRepoRoot(): string {
  return process.cwd();
}

export function getSandboxTaskDir(taskId: string): string {
  assertSafeTaskId(taskId);
  return path.join(getRepoRoot(), "sandbox", "tasks", taskId);
}

export function assertSafeTaskId(taskId: string): void {
  if (!TASK_ID_PATTERN.test(taskId))
    throw new Error(`허용되지 않은 taskId입니다: ${taskId}`);
}

export function normalizeRelativePath(relativePath: string): string {
  return relativePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

export function isEnvPath(relativePath: string): boolean {
  const base = path.posix.basename(normalizeRelativePath(relativePath));
  return base === ".env" || base.startsWith(".env.");
}

export function isForbiddenAppPath(relativePath: string): boolean {
  const normalized = normalizeRelativePath(relativePath);
  return FORBIDDEN_SANDBOX_PREFIXES.some(
    (prefix) =>
      normalized === prefix.slice(0, -1) || normalized.startsWith(prefix),
  );
}

const BLOCKED_SEGMENTS = new Set(["node_modules", ".git", ".next", "runs"]);

const BLOCKED_SYSTEM_PREFIXES = [
  "/etc/",
  "/sys/",
  "/proc/",
  "/dev/",
  "/bin/",
  "/sbin/",
  "/private/etc/",
];

export function isForbiddenRepoPath(relativePath: string): boolean {
  const normalized = normalizeRelativePath(relativePath);
  return FORBIDDEN_REPO_PREFIXES.some(
    (prefix) =>
      normalized === prefix.slice(0, -1) ||
      normalized.startsWith(prefix) ||
      normalized.includes(`/${prefix}`),
  );
}

export function hasBlockedPathSegment(inputPath: string): boolean {
  const normalized = inputPath.replace(/\\/g, "/");
  return normalized
    .split("/")
    .filter(Boolean)
    .some((segment) => BLOCKED_SEGMENTS.has(segment));
}

export function isBlockedSystemPath(resolvedPath: string): boolean {
  const normalized = resolvedPath.replace(/\\/g, "/");
  return BLOCKED_SYSTEM_PREFIXES.some(
    (prefix) =>
      normalized === prefix.slice(0, -1) || normalized.startsWith(prefix),
  );
}

export function resolveRepoPath(inputPath: string): string {
  if (!inputPath || inputPath.includes("\0"))
    throw new Error("경로가 올바르지 않습니다.");

  const trimmed = inputPath.trim();
  if (isEnvPath(trimmed))
    throw new Error(".env 파일은 읽을 수 없습니다.");

  if (path.isAbsolute(trimmed)) {
    const resolved = path.resolve(trimmed);
    if (isEnvPath(resolved))
      throw new Error(".env 파일은 읽을 수 없습니다.");
    if (hasBlockedPathSegment(resolved))
      throw new Error("해당 경로는 허용되지 않습니다.");
    if (isBlockedSystemPath(resolved))
      throw new Error("시스템 경로는 허용되지 않습니다.");
    return resolved;
  }

  const normalized = normalizeRelativePath(trimmed);
  if (!normalized)
    throw new Error("경로가 올바르지 않습니다.");

  if (normalized.split("/").some((part) => part === ".." || part === ""))
    throw new Error("경로 탈출은 허용되지 않습니다.");

  if (isForbiddenRepoPath(normalized))
    throw new Error("해당 경로는 허용되지 않습니다.");

  const repoRoot = path.resolve(getRepoRoot());
  const resolved = path.resolve(repoRoot, normalized);
  const relative = path.relative(repoRoot, resolved);

  if (relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error("저장소 밖 상대 경로는 허용되지 않습니다.");

  return resolved;
}

export function isTestPath(relativePath: string): boolean {
  const normalized = normalizeRelativePath(relativePath);
  return /\.(test|spec)\.tsx?$/.test(normalized);
}

export function resolveSandboxPath(taskId: string, relativePath: string): string {
  assertSafeTaskId(taskId);

  if (!relativePath || relativePath.includes("\0"))
    throw new Error("경로가 올바르지 않습니다.");

  if (path.isAbsolute(relativePath))
    throw new Error("절대 경로는 허용되지 않습니다.");

  const normalized = normalizeRelativePath(relativePath);
  if (!normalized)
    throw new Error("경로가 올바르지 않습니다.");

  if (normalized.split("/").some((part) => part === ".." || part === ""))
    throw new Error("경로 탈출은 허용되지 않습니다.");

  if (isEnvPath(normalized))
    throw new Error(".env 파일은 읽을 수 없습니다.");

  if (isForbiddenAppPath(normalized))
    throw new Error("앱 소스 경로는 허용되지 않습니다.");

  const taskRoot = path.resolve(getSandboxTaskDir(taskId));
  const resolved = path.resolve(taskRoot, normalized);
  const relative = path.relative(taskRoot, resolved);

  if (relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error("샌드박스 밖 경로는 허용되지 않습니다.");

  return resolved;
}
