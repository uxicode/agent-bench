export const CHAT_SUB_QUESTION_COUNT = 3;
export const CHAT_DECOMPOSE_TEMPERATURE = 0.2;
export const CHAT_WORKER_TEMPERATURE = 0.7;

export const CHAT_ROUTE = {
  direct: "direct",
  decompose: "decompose",
} as const;

export type ChatRoute = (typeof CHAT_ROUTE)[keyof typeof CHAT_ROUTE];

export const CHAT_TOOLS_FALLBACK_ROUTE = CHAT_ROUTE.decompose;
