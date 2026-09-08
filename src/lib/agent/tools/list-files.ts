import { readdir } from "node:fs/promises";
import path from "node:path";
import { getSandboxTaskDir, isEnvPath } from "@/lib/agent/guards";

export async function listFiles(taskId: string): Promise<string[]> {
  const root = getSandboxTaskDir(taskId);

  try {
    return await walk(root, "");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return [];
    throw error;
  }
}

async function walk(dir: string, prefix: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (isEnvPath(relative)) continue;

    if (entry.isDirectory()) {
      files.push(...(await walk(path.join(dir, entry.name), relative)));
      continue;
    }

    files.push(relative);
  }

  return files;
}
