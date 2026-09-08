import { isTestPath } from "@/lib/agent/guards";
import { hashText } from "@/lib/agent/error-hash";
import type { AgentPatchPayload, TestLock } from "@/types/agent";

export function createFileLock(
  files: { path: string; content: string }[],
): TestLock {
  const hashes: Record<string, string> = {};
  for (const file of files) hashes[file.path] = hashText(file.content);
  return { hashes };
}

export function createTestLock(
  files: { path: string; content: string }[],
): TestLock {
  return createFileLock(files.filter((file) => isTestPath(file.path)));
}

export function assertPatchRespectsLock(
  patch: AgentPatchPayload,
  lock: TestLock,
): void {
  const locked = patch.files.find((file) => lock.hashes[file.path] !== undefined);
  if (locked)
    throw new Error(`테스트 lock — 패치 거부 (${locked.path})`);
}

export function hasLockedTestFiles(lock: TestLock): boolean {
  return Object.keys(lock.hashes).length > 0;
}
