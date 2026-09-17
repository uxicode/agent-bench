import { mkdir, readFile as readFsFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { AGENT_READ_FILE_MAX_BYTES } from "@/constants/agent";
import { resolveRepoPath } from "@/lib/agent/guards";
import {
  resolveSourceFilename,
  sandboxImplPath,
  sandboxTestPath,
  toSiblingTestPath,
} from "@/lib/agent/source";
import { applyPatch } from "@/lib/agent/tools/apply-patch";
import type { AgentSourceKind } from "@/constants/agent";

export interface SeededWorkspace {
  implPath: string;
  testPath: string;
  filename: string;
  sourceCode: string;
  originalPath?: string;
  existingTest?: { path: string; content: string };
}

export async function seedWorkspace(input: {
  taskId: string;
  sourceKind: AgentSourceKind;
  code?: string;
  path?: string;
  filename?: string;
}): Promise<SeededWorkspace> {
  if (input.sourceKind === "path") {
    const originalPath = input.path?.trim() ?? "";
    const sourceCode = await readRepoFile(originalPath);
    const filename = path.posix.basename(originalPath.replace(/\\/g, "/"));
    const implPath = sandboxImplPath(filename);
    const testPath = sandboxTestPath(filename);
    await applyPatch(input.taskId, {
      files: [{ path: implPath, content: sourceCode }],
    });

    const sibling = toSiblingTestPath(originalPath);
    const existingTest = await readRepoFileIfExists(sibling);
    if (existingTest) {
      await applyPatch(input.taskId, {
        files: [{ path: testPath, content: existingTest }],
      });
    }

    return {
      implPath,
      testPath,
      filename,
      sourceCode,
      originalPath,
      existingTest: existingTest
        ? { path: sibling, content: existingTest }
        : undefined,
    };
  }

  const sourceCode = input.code?.trim() ?? "";
  if (!sourceCode) throw new Error("코드가 비어 있습니다.");
  const filename = resolveSourceFilename(input.filename, sourceCode);
  const implPath = sandboxImplPath(filename);
  const testPath = sandboxTestPath(filename);
  await applyPatch(input.taskId, {
    files: [{ path: implPath, content: sourceCode }],
  });

  return { implPath, testPath, filename, sourceCode };
}

export async function readRepoFile(relativePath: string): Promise<string> {
  const absPath = resolveRepoPath(relativePath);
  const info = await stat(absPath);
  if (info.size > AGENT_READ_FILE_MAX_BYTES)
    throw new Error("파일이 64KB를 초과합니다.");
  return readFsFile(absPath, "utf8");
}

export async function writeRepoFile(
  relativePath: string,
  content: string,
): Promise<void> {
  const absPath = resolveRepoPath(relativePath);
  await mkdir(path.dirname(absPath), { recursive: true });
  await writeFile(absPath, content, "utf8");
}

export async function writeBackResults(input: {
  taskId: string;
  originalPath: string;
  implPath: string;
  testPath: string;
  writeImpl: boolean;
  writeTest: boolean;
}): Promise<string[]> {
  const written: string[] = [];
  const { readFile } = await import("@/lib/agent/tools/read-file");

  if (input.writeImpl) {
    const impl = await readFile(input.taskId, input.implPath);
    await writeRepoFile(input.originalPath, impl.content);
    written.push(input.originalPath);
  }

  if (input.writeTest) {
    const test = await readFile(input.taskId, input.testPath).catch(() => null);
    if (test) {
      const dest = toSiblingTestPath(input.originalPath);
      await writeRepoFile(dest, test.content);
      written.push(dest);
    }
  }

  return written;
}

async function readRepoFileIfExists(relativePath: string): Promise<string | null> {
  try {
    return await readRepoFile(relativePath);
  } catch {
    return null;
  }
}
