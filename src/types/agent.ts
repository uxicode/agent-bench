import type {
  AgentAction,
  AgentSourceKind,
  AgentStatus,
  PatchStrategy,
  RunTestCommand,
} from "@/constants/agent";

export interface AgentRunRequest {
  action: AgentAction;
  sourceKind: AgentSourceKind;
  code?: string;
  path?: string;
  instruction?: string;
  taskId?: string;
}

export interface AgentFilePatch {
  path: string;
  content: string;
}

export interface AgentPatchPayload {
  files: AgentFilePatch[];
}

export interface AgentTimelineEvent {
  status: AgentStatus;
  at: string;
  message: string;
  attempt?: number;
}

export interface AgentFileDiff {
  path: string;
  before: string;
  after: string;
}

export interface AgentRunResponse {
  runId: string;
  taskId: string;
  status: AgentStatus;
  attempts: number;
  timeline: AgentTimelineEvent[];
  stdoutExcerpt: string;
  diff: AgentFileDiff[];
  errorMessage?: string;
}

export interface AgentRunRecord extends AgentRunResponse {
  spec: string;
  action: AgentAction;
  sourceKind: AgentSourceKind;
  sourcePath?: string;
  startedAt: string;
  endedAt: string;
  errorHashes: string[];
  lockedTestHashes: Record<string, string>;
  strategy?: PatchStrategy;
}

export interface AgentLoopInput {
  action: AgentAction;
  sourceKind: AgentSourceKind;
  code?: string;
  path?: string;
  instruction?: string;
  taskId: string;
  maxAttempts?: number;
}

export interface TestLock {
  hashes: Record<string, string>;
}

export interface FileSnapshot {
  files: Record<string, string | null>;
}

export interface RunTestsResult {
  ok: boolean;
  stdoutExcerpt: string;
  failMessage: string;
  stackExcerpt: string;
}

export interface ApplyPatchResult {
  applied: string[];
  rejectedReason?: string;
}

export interface AgentModelClient {
  invoke(messages: { role: string; content: string }[]): Promise<string>;
}

export interface AgentLoopDeps {
  modelClient?: AgentModelClient;
  runTestsFn?: (
    taskId: string,
    command?: RunTestCommand,
  ) => Promise<RunTestsResult>;
}
