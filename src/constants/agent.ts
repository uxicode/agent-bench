export const DEFAULT_MAX_ATTEMPTS = 4;
export const AGENT_TEST_TIMEOUT_MS = 60_000;
export const AGENT_READ_FILE_MAX_BYTES = 64 * 1024;
export const AGENT_MAX_FILES = 3;
export const AGENT_STACK_LINES = 8;
export const AGENT_TEMPERATURE = 0.3;
export const AGENT_STDOUT_EXCERPT_BYTES = 4 * 1024;

export const AGENT_STATUS = {
  idle: "Idle",
  preparingWorkspace: "PreparingWorkspace",
  writingTests: "WritingTests",
  lockingTests: "LockingTests",
  writingImpl: "WritingImpl",
  runningTests: "RunningTests",
  analyzingFailure: "AnalyzingFailure",
  patchingImpl: "PatchingImpl",
  succeeded: "Succeeded",
  failedMaxAttempts: "FailedMaxAttempts",
  failedPolicy: "FailedPolicy",
  failedInfra: "FailedInfra",
} as const;

export type AgentStatus = (typeof AGENT_STATUS)[keyof typeof AGENT_STATUS];

export const AGENT_STATUS_LABEL = {
  Idle: "대기",
  PreparingWorkspace: "작업 공간 준비",
  WritingTests: "테스트 작성",
  LockingTests: "잠금",
  WritingImpl: "코드 변환",
  RunningTests: "테스트 실행",
  AnalyzingFailure: "실패 분석",
  PatchingImpl: "코드 수정",
  Succeeded: "성공",
  FailedMaxAttempts: "시도 횟수 초과",
  FailedPolicy: "정책 실패",
  FailedInfra: "인프라 실패",
} as const;

export const AGENT_ACTION = {
  test: "test",
  optimize: "optimize",
  refactor: "refactor",
} as const;

export type AgentAction = (typeof AGENT_ACTION)[keyof typeof AGENT_ACTION];

export const AGENT_ACTION_LABEL = {
  test: "테스트",
  optimize: "최적화",
  refactor: "리팩터링",
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
