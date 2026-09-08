import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getRepoRoot } from "@/lib/agent/guards";
import type { AgentRunRecord } from "@/types/agent";

export async function writeRunRecord(record: AgentRunRecord): Promise<void> {
  const dir = path.join(getRepoRoot(), "runs");
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, `${record.runId}.json`),
    JSON.stringify(record, null, 2),
    "utf8",
  );
}
