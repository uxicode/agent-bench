import {
  AGENT_ACTION,
  AGENT_STATUS,
  AGENT_TEMPERATURE,
  DEFAULT_MAX_ATTEMPTS,
  PATCH_STRATEGY,
  type AgentAction,
  type AgentStatus,
  type PatchStrategy,
} from "@/constants/agent";
import { MESSAGE_ROLE, OLLAMA_MODELS } from "@/constants/ollama";
import { computeErrorHash, hashText } from "@/lib/agent/error-hash";
import { getSandboxTaskDir } from "@/lib/agent/guards";
import { parseModelPatch } from "@/lib/agent/parse-model-json";
import {
  buildJsonRetryPrompt,
  buildPatchPrompt,
  buildSystemPrompt,
  buildTransformPrompt,
  buildWriteTestsPrompt,
} from "@/lib/agent/prompts";
import { writeRunRecord } from "@/lib/agent/run-record";
import { filenameToTaskId, inferFilename } from "@/lib/agent/source";
import { createFileLock, createTestLock, hasLockedTestFiles } from "@/lib/agent/test-lock";
import { applyPatch } from "@/lib/agent/tools/apply-patch";
import { listFiles } from "@/lib/agent/tools/list-files";
import { readFile } from "@/lib/agent/tools/read-file";
import { runTests } from "@/lib/agent/tools/run-tests";
import { seedWorkspace, writeBackResults } from "@/lib/agent/workspace";
import { createChatOllama } from "@/lib/ollama/client";
import { getChunkText, toLangChainMessages } from "@/lib/ollama/messages";
import type { ChatMessage } from "@/types/chat";
import type {
  AgentFileDiff,
  AgentLoopDeps,
  AgentLoopInput,
  AgentModelClient,
  AgentPatchPayload,
  AgentRunRecord,
  AgentRunResponse,
  AgentTimelineEvent,
  TestLock,
} from "@/types/agent";
import { mkdir, rm } from "node:fs/promises";

export async function runAgentLoop(
  input: AgentLoopInput,
  deps?: AgentLoopDeps,
): Promise<AgentRunResponse> {
  const maxAttempts = input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const runId = `run-${Date.now()}`;
  const startedAt = new Date().toISOString();
  const timeline: AgentTimelineEvent[] = [];
  const errorHashes: string[] = [];
  const modelClient = deps?.modelClient ?? createDefaultModelClient();
  const runTestsFn = deps?.runTestsFn ?? runTests;
  const brief = buildBrief(input);
  let attempts = 0;
  let stdoutExcerpt = "";
  let lock: TestLock = { hashes: {} };
  let strategy: PatchStrategy = PATCH_STRATEGY.partial;
  let lastFailMessage = "";
  let lastStackExcerpt = "";
  const originals = new Map<string, string>();

  function addEvent(status: AgentStatus, message: string, attempt?: number) {
    timeline.push({
      status,
      at: new Date().toISOString(),
      message,
      attempt,
    });
  }

  async function finish(
    status: AgentStatus,
    errorMessage?: string,
  ): Promise<AgentRunResponse> {
    const diff = await collectDiff(input.taskId, originals);
    const response: AgentRunResponse = {
      runId,
      taskId: input.taskId,
      status,
      attempts,
      timeline,
      stdoutExcerpt,
      diff,
      errorMessage,
    };
    const record: AgentRunRecord = {
      ...response,
      spec: brief,
      action: input.action,
      sourceKind: input.sourceKind,
      sourcePath: input.path,
      startedAt,
      endedAt: new Date().toISOString(),
      errorHashes,
      lockedTestHashes: lock.hashes,
      strategy,
    };
    await writeRunRecord(record).catch(() => undefined);
    return response;
  }

  try {
    addEvent(AGENT_STATUS.preparingWorkspace, "대상 코드를 작업 공간에 넣습니다.");
    await rm(getSandboxTaskDir(input.taskId), { recursive: true, force: true });
    await mkdir(getSandboxTaskDir(input.taskId), { recursive: true });

    const workspace = await seedWorkspace({
      taskId: input.taskId,
      sourceKind: input.sourceKind,
      code: input.code,
      path: input.path,
    });
    originals.set(workspace.implPath, workspace.sourceCode);

    const needsGeneratedTests =
      input.action === AGENT_ACTION.test || !workspace.existingTest;

    if (needsGeneratedTests) {
      addEvent(AGENT_STATUS.writingTests, "대상 코드에 대한 테스트를 작성합니다.");
      const testPatch = await requestPatch(modelClient, [
        systemMessage(),
        userMessage(
          buildWriteTestsPrompt({
            action: input.action,
            sourceCode: workspace.sourceCode,
            implPath: workspace.implPath,
            testPath: workspace.testPath,
            instruction: input.instruction,
          }),
        ),
      ]);
      const testApply = await applyPatch(input.taskId, testPatch);
      if (testApply.rejectedReason)
        return finish(AGENT_STATUS.failedInfra, testApply.rejectedReason);
    } else {
      addEvent(
        AGENT_STATUS.writingTests,
        "경로 옆의 기존 테스트 파일을 사용합니다.",
      );
    }

    addEvent(AGENT_STATUS.lockingTests, lockMessage(input.action));
    if (input.action === AGENT_ACTION.test) {
      const impl = await readFile(input.taskId, workspace.implPath);
      lock = createFileLock([impl]);
    } else {
      const testFiles = (await listFiles(input.taskId)).filter((file) =>
        /\.(test|spec)\.tsx?$/.test(file),
      );
      lock = createTestLock(
        await Promise.all(
          testFiles.map(async (file) => readFile(input.taskId, file)),
        ),
      );
      if (!hasLockedTestFiles(lock))
        return finish(
          AGENT_STATUS.failedPolicy,
          "테스트 파일이 없어 lock할 수 없습니다.",
        );
    }

    if (input.action !== AGENT_ACTION.test) {
      addEvent(
        AGENT_STATUS.writingImpl,
        input.action === AGENT_ACTION.optimize
          ? "구현을 최적화합니다."
          : "구현을 리팩터링합니다.",
      );
      const transform = await requestPatch(modelClient, [
        systemMessage(),
        userMessage(
          buildTransformPrompt({
            action: input.action,
            sourceCode: workspace.sourceCode,
            filesContext: await buildFilesContext(input.taskId),
            implPath: workspace.implPath,
            instruction: input.instruction,
          }),
        ),
      ]);
      const applied = await applyPatch(input.taskId, transform, lock);
      if (applied.rejectedReason)
        addEvent(AGENT_STATUS.writingImpl, lockOrReason(applied.rejectedReason));
    }

    if (!(await isLockIntact(input.taskId, lock)))
      return finish(AGENT_STATUS.failedPolicy, "잠긴 파일이 디스크에서 변경되었습니다.");

    const lockKind = input.action === AGENT_ACTION.test ? "impl" : "test";

    while (attempts < maxAttempts) {
      attempts += 1;
      addEvent(AGENT_STATUS.runningTests, "테스트를 실행합니다.", attempts);
      const result = await runTestsFn(input.taskId);
      stdoutExcerpt = result.stdoutExcerpt;

      if (result.ok) {
        addEvent(AGENT_STATUS.succeeded, successMessage(input.action), attempts);
        if (workspace.originalPath) {
          const written = await writeBackResults({
            taskId: input.taskId,
            originalPath: workspace.originalPath,
            implPath: workspace.implPath,
            testPath: workspace.testPath,
            writeImpl: input.action !== AGENT_ACTION.test,
            writeTest: true,
          });
          addEvent(
            AGENT_STATUS.succeeded,
            `원본 경로에 반영: ${written.join(", ")}`,
          );
        }
        return finish(AGENT_STATUS.succeeded);
      }

      addEvent(AGENT_STATUS.analyzingFailure, "실패 로그를 분석합니다.", attempts);
      lastFailMessage = result.failMessage;
      lastStackExcerpt = result.stackExcerpt;
      const errorHash = computeErrorHash(result.failMessage, result.stackExcerpt);
      errorHashes.push(errorHash);
      if (errorHashes.filter((hash) => hash === errorHash).length >= 2) {
        strategy = PATCH_STRATEGY.rewrite;
        addEvent(
          AGENT_STATUS.analyzingFailure,
          "동일 에러가 반복되어 대상 파일을 다시 작성합니다.",
          attempts,
        );
      }

      if (attempts >= maxAttempts) break;

      addEvent(
        AGENT_STATUS.patchingImpl,
        lockKind === "impl" ? "테스트만 수정합니다." : "구현만 수정합니다.",
        attempts,
      );
      const patch = await requestPatch(modelClient, [
        systemMessage(),
        userMessage(
          buildPatchPrompt({
            filesContext: await buildFilesContext(input.taskId),
            failMessage: lastFailMessage,
            stackExcerpt: lastStackExcerpt,
            strategy,
            lockKind,
          }),
        ),
      ]);
      const patched = await applyPatch(input.taskId, patch, lock);
      if (patched.rejectedReason)
        addEvent(AGENT_STATUS.patchingImpl, lockOrReason(patched.rejectedReason), attempts);

      if (!(await isLockIntact(input.taskId, lock)))
        return finish(
          AGENT_STATUS.failedPolicy,
          "잠긴 파일이 디스크에서 변경되었습니다.",
        );
    }

    addEvent(
      AGENT_STATUS.failedMaxAttempts,
      `최대 시도 ${maxAttempts}회를 초과했습니다.`,
      attempts,
    );
    return finish(AGENT_STATUS.failedMaxAttempts, lastFailMessage);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알 수 없는 인프라 오류";
    addEvent(AGENT_STATUS.failedInfra, message);
    return finish(AGENT_STATUS.failedInfra, message);
  }
}

export function resolveAgentTaskId(input: {
  taskId?: string;
  sourceKind: "code" | "path";
  code?: string;
  path?: string;
}): string {
  if (input.taskId) return filenameToTaskId(input.taskId);
  if (input.sourceKind === "path" && input.path)
    return filenameToTaskId(input.path);
  if (input.code) return filenameToTaskId(inferFilename(input.code));
  return `task-${Date.now()}`;
}

function createDefaultModelClient(): AgentModelClient {
  return {
    async invoke(messages) {
      const model = createChatOllama({
        model: OLLAMA_MODELS.qwen25Coder,
        temperature: AGENT_TEMPERATURE,
      });
      const chatMessages = messages.map((message) => ({
        role: message.role as ChatMessage["role"],
        content: message.content,
      }));
      const ai = await model.invoke(toLangChainMessages(chatMessages));
      return getChunkText(ai.content);
    },
  };
}

async function requestPatch(
  modelClient: AgentModelClient,
  messages: ChatMessage[],
): Promise<AgentPatchPayload> {
  const first = await modelClient.invoke(messages);
  try {
    return parseModelPatch(first);
  } catch {
    const retry = await modelClient.invoke([
      ...messages,
      { role: MESSAGE_ROLE.assistant, content: first },
      userMessage(buildJsonRetryPrompt()),
    ]);
    return parseModelPatch(retry);
  }
}

async function buildFilesContext(taskId: string): Promise<string> {
  const files = await listFiles(taskId);
  if (files.length === 0) return "(empty)";

  const chunks = await Promise.all(
    files.map(async (file) => {
      const { content } = await readFile(taskId, file);
      return `--- ${file}\n${content}`;
    }),
  );
  return chunks.join("\n\n");
}

async function collectDiff(
  taskId: string,
  originals: Map<string, string>,
): Promise<AgentFileDiff[]> {
  const files = await listFiles(taskId);
  return Promise.all(
    files.map(async (file) => {
      const { content } = await readFile(taskId, file);
      return { path: file, before: originals.get(file) ?? "", after: content };
    }),
  );
}

async function isLockIntact(taskId: string, lock: TestLock): Promise<boolean> {
  for (const [relativePath, expected] of Object.entries(lock.hashes)) {
    try {
      const file = await readFile(taskId, relativePath);
      if (hashText(file.content) !== expected) return false;
    } catch {
      return false;
    }
  }
  return true;
}

function buildBrief(input: AgentLoopInput): string {
  const source =
    input.sourceKind === "path" ? input.path : (input.code ?? "").slice(0, 200);
  return [`action=${input.action}`, source, input.instruction]
    .filter(Boolean)
    .join("\n");
}

function lockMessage(action: AgentAction): string {
  return action === AGENT_ACTION.test
    ? "원본 구현을 잠급니다. 테스트만 고칠 수 있습니다."
    : "테스트를 잠급니다. 구현만 고칠 수 있습니다.";
}

function successMessage(action: AgentAction): string {
  if (action === AGENT_ACTION.test) return "테스트가 통과했습니다.";
  if (action === AGENT_ACTION.optimize)
    return "최적화 후에도 테스트가 통과했습니다.";
  return "리팩터링 후에도 테스트가 통과했습니다.";
}

function lockOrReason(reason: string): string {
  return reason.includes("lock") ? "lock — 패치 거부" : reason;
}

function systemMessage(): ChatMessage {
  return { role: MESSAGE_ROLE.system, content: buildSystemPrompt() };
}

function userMessage(content: string): ChatMessage {
  return { role: MESSAGE_ROLE.user, content };
}
