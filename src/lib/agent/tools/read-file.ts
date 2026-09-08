import { readFile as readFsFile, stat } from "node:fs/promises";
import { AGENT_READ_FILE_MAX_BYTES } from "@/constants/agent";
import { resolveSandboxPath } from "@/lib/agent/guards";

export async function readFile(
  taskId: string,
  relativePath: string,
): Promise<{ path: string; content: string }> {
  const absPath = resolveSandboxPath(taskId, relativePath);
  const info = await stat(absPath);

  if (info.size > AGENT_READ_FILE_MAX_BYTES)
    throw new Error("파일이 64KB를 초과합니다.");

  const content = await readFsFile(absPath, "utf8");
  return { path: relativePath, content };
}
