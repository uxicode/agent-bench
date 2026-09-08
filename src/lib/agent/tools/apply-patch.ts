import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { AGENT_MAX_FILES } from "@/constants/agent";
import { resolveSandboxPath } from "@/lib/agent/guards";
import { restoreSnapshot, snapshotFiles } from "@/lib/agent/snapshot";
import { assertPatchRespectsLock } from "@/lib/agent/test-lock";
import { listFiles } from "@/lib/agent/tools/list-files";
import type {
  AgentPatchPayload,
  ApplyPatchResult,
  TestLock,
} from "@/types/agent";

export async function applyPatch(
  taskId: string,
  payload: AgentPatchPayload,
  lock?: TestLock,
): Promise<ApplyPatchResult> {
  if (!payload || !Array.isArray(payload.files) || payload.files.length === 0)
    return { applied: [], rejectedReason: "empty-patch" };

  if (lock) {
    try {
      assertPatchRespectsLock(payload, lock);
    } catch (error) {
      return {
        applied: [],
        rejectedReason:
          error instanceof Error ? error.message : "test-lock",
      };
    }
  }

  const targets = payload.files.map((file) => ({
    relativePath: file.path,
    absPath: resolveSandboxPath(taskId, file.path),
    content: file.content,
  }));

  const existing = await listFiles(taskId);
  const nextPaths = new Set([...existing, ...targets.map((item) => item.relativePath)]);
  if (nextPaths.size > AGENT_MAX_FILES)
    return { applied: [], rejectedReason: "max-files" };

  const snapshot = await snapshotFiles(targets.map((item) => item.absPath));

  try {
    for (const target of targets) {
      await mkdir(path.dirname(target.absPath), { recursive: true });
      await writeFile(target.absPath, target.content, "utf8");
    }
  } catch (error) {
    await restoreSnapshot(snapshot);
    throw error;
  }

  return { applied: targets.map((item) => item.relativePath) };
}
