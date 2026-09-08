import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FileSnapshot } from "@/types/agent";

export async function snapshotFiles(absPaths: string[]): Promise<FileSnapshot> {
  const files: Record<string, string | null> = {};

  await Promise.all(
    absPaths.map(async (absPath) => {
      try {
        files[absPath] = await readFile(absPath, "utf8");
      } catch {
        files[absPath] = null;
      }
    }),
  );

  return { files };
}

export async function restoreSnapshot(snapshot: FileSnapshot): Promise<void> {
  for (const [absPath, content] of Object.entries(snapshot.files)) {
    if (content === null) {
      await unlink(absPath).catch(() => undefined);
      continue;
    }

    await mkdir(path.dirname(absPath), { recursive: true });
    await writeFile(absPath, content, "utf8");
  }
}
