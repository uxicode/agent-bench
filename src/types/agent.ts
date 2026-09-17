import type {
  AgentAction,
  AgentSourceKind,
  AgentStatus,
  PatchStrategy,
} from "@/constants/agent";

export interface AgentRunRequest {
  action?: AgentAction;
  sourceKind: AgentSourceKind;
  code?: string;
  path?: string;
  filename?: string;
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
  displayPath?: string;
  before: string;
  after: string;
}

export interface CodeAnalysisFinding {
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  location?: string;
}

export interface CodeAnalysisNotes {
  summary: string;
  findings: CodeAnalysisFinding[];
  risks: string[];
  suggestions: string[];
}

export interface AgentRunResponse {
  runId: string;
  taskId: string;
  status: AgentStatus;
  attempts: number;
  timeline: AgentTimelineEvent[];
  stdoutExcerpt: string;
  diff: AgentFileDiff[];
  report?: string;
  analysis?: CodeAnalysisNotes;
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
  filename?: string;
  instruction?: string;
  taskId: string;
  signal?: AbortSignal;
}

export interface ReviewPipelineInput {
  filename: string;
  sourceCode: string;
  instruction?: string;
}

export interface ReviewPipelineResult {
  analysis: CodeAnalysisNotes;
  report: string;
}

export interface ReviewPipelineDeps {
  analyzer?: ReviewModelClient;
  reporter?: ReviewModelClient;
  unloadModel?: (model: string) => Promise<void>;
}

export interface ReviewModelClient {
  invoke(messages: { role: string; content: string }[]): Promise<string>;
}

export interface AgentLoopDeps {
  runReview?: (input: ReviewPipelineInput) => Promise<ReviewPipelineResult>;
  onEvent?: (event: AgentTimelineEvent) => void;
}

export const AGENT_STREAM_EVENT = {
  connection: "connection",
  log: "log",
  result: "result",
  error: "error",
} as const;

export type AgentStreamEventType =
  (typeof AGENT_STREAM_EVENT)[keyof typeof AGENT_STREAM_EVENT];

export interface AgentConnectionStreamEvent {
  type: "connection";
  state: "connecting" | "streaming" | "completed" | "failed";
  message: string;
  ollamaBaseUrl?: string;
}

export interface AgentLogStreamEvent {
  type: "log";
  event: AgentTimelineEvent;
}

export interface AgentResultStreamEvent {
  type: "result";
  result: AgentRunResponse;
}

export interface AgentErrorStreamEvent {
  type: "error";
  error: string;
}

export type AgentRunStreamEvent =
  | AgentConnectionStreamEvent
  | AgentLogStreamEvent
  | AgentResultStreamEvent
  | AgentErrorStreamEvent;

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
