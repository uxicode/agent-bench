export const DEFAULT_MAX_ATTEMPTS = 4;
export const AGENT_TEST_TIMEOUT_MS = 60_000;
export const AGENT_READ_FILE_MAX_BYTES = 64 * 1024;
export const AGENT_MAX_FILES = 3;
export const AGENT_STACK_LINES = 8;
export const AGENT_TEMPERATURE = 0.3;
export const REVIEW_ANALYZER_TEMPERATURE = 0.2;
export const REVIEW_REPORTER_TEMPERATURE = 0.4;
export const AGENT_STDOUT_EXCERPT_BYTES = 4 * 1024;

export const AGENT_STATUS = {
  idle: "Idle",
  loadingSource: "LoadingSource",
  analyzingCode: "AnalyzingCode",
  unloadingModel: "UnloadingModel",
  writingReport: "WritingReport",
  succeeded: "Succeeded",
  failedInfra: "FailedInfra",
} as const;

export type AgentStatus = (typeof AGENT_STATUS)[keyof typeof AGENT_STATUS];

export const AGENT_STATUS_LABEL = {
  Idle: "대기",
  LoadingSource: "소스 로드",
  AnalyzingCode: "기술 분석",
  UnloadingModel: "모델 언로드",
  WritingReport: "리포트 작성",
  Succeeded: "성공",
  FailedInfra: "인프라 실패",
} as const;

export const AGENT_CONNECTION_STATE = {
  idle: "idle",
  connecting: "connecting",
  streaming: "streaming",
  completed: "completed",
  failed: "failed",
} as const;

export type AgentConnectionState =
  (typeof AGENT_CONNECTION_STATE)[keyof typeof AGENT_CONNECTION_STATE];

export const AGENT_CONNECTION_LABEL = {
  idle: "대기",
  connecting: "연결 중",
  streaming: "스트림 수신",
  completed: "완료",
  failed: "연결 실패",
} as const;

export const REVIEW_PIPELINE_STEPS = [
  { status: AGENT_STATUS.loadingSource, label: "소스" },
  { status: AGENT_STATUS.analyzingCode, label: "분석" },
  { status: AGENT_STATUS.unloadingModel, label: "언로드" },
  { status: AGENT_STATUS.writingReport, label: "리포트" },
] as const;

export const AGENT_ACTION = {
  review: "review",
} as const;

export type AgentAction = (typeof AGENT_ACTION)[keyof typeof AGENT_ACTION];

export const AGENT_ACTION_LABEL = {
  review: "코드리뷰",
} as const;

export const AGENT_SOURCE_KIND = {
  code: "code",
  path: "path",
} as const;

export type AgentSourceKind =
  (typeof AGENT_SOURCE_KIND)[keyof typeof AGENT_SOURCE_KIND];

export function isAgentAction(value: unknown): value is AgentAction {
  return (
    typeof value === "string" &&
    Object.values(AGENT_ACTION).includes(value as AgentAction)
  );
}

export function isAgentSourceKind(value: unknown): value is AgentSourceKind {
  return (
    typeof value === "string" &&
    Object.values(AGENT_SOURCE_KIND).includes(value as AgentSourceKind)
  );
}

export const RUN_TEST_COMMAND = {
  vitest: "vitest",
  npmTest: "npmTest",
  tsc: "tsc",
} as const;

export type RunTestCommand =
  (typeof RUN_TEST_COMMAND)[keyof typeof RUN_TEST_COMMAND];

export const TASK_ID_PATTERN = /^[a-z0-9-]+$/;

export const PATCH_STRATEGY = {
  partial: "partial",
  rewrite: "rewrite",
} as const;

export type PatchStrategy =
  (typeof PATCH_STRATEGY)[keyof typeof PATCH_STRATEGY];
