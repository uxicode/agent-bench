import { AGENT_STREAM_EVENT } from "@/types/agent";
import type {
  AgentRunResponse,
  AgentRunStreamEvent,
  AgentTimelineEvent,
} from "@/types/agent";

export function encodeAgentStreamEvent(event: AgentRunStreamEvent): string {
  return `${JSON.stringify(event)}\n`;
}

export function parseAgentStreamLine(line: string): AgentRunStreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }

  return toAgentStreamEvent(parsed);
}

export async function consumeAgentRunStream(
  response: Response,
  onEvent: (event: AgentRunStreamEvent) => void,
): Promise<AgentRunResponse> {
  if (!response.body) {
    const payload = await readJsonError(response);
    throw new Error(payload ?? "에이전트 실행에 실패했습니다.");
  }

  if (!response.ok) {
    const payload = await readJsonError(response);
    throw new Error(payload ?? "에이전트 실행에 실패했습니다.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: AgentRunResponse | undefined;
  let streamError: string | undefined;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const event = parseAgentStreamLine(line);
      if (!event) continue;
      onEvent(event);
      if (event.type === AGENT_STREAM_EVENT.result) result = event.result;
      if (event.type === AGENT_STREAM_EVENT.error) streamError = event.error;
    }
  }

  const leftover = parseAgentStreamLine(buffer);
  if (leftover) {
    onEvent(leftover);
    if (leftover.type === AGENT_STREAM_EVENT.result) result = leftover.result;
    if (leftover.type === AGENT_STREAM_EVENT.error) streamError = leftover.error;
  }

  if (streamError) throw new Error(streamError);
  if (!result) throw new Error("스트림이 결과를 보내지 않았습니다.");
  return result;
}

export function isAgentTimelineEvent(value: unknown): value is AgentTimelineEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as AgentTimelineEvent;
  return (
    typeof event.status === "string" &&
    typeof event.at === "string" &&
    typeof event.message === "string"
  );
}

function toAgentStreamEvent(parsed: unknown): AgentRunStreamEvent | null {
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as { type?: unknown };

  if (record.type === AGENT_STREAM_EVENT.connection) {
    const event = parsed as {
      state?: unknown;
      message?: unknown;
      ollamaBaseUrl?: unknown;
    };
    if (
      (event.state === "connecting" ||
        event.state === "streaming" ||
        event.state === "completed" ||
        event.state === "failed") &&
      typeof event.message === "string"
    ) {
      return {
        type: AGENT_STREAM_EVENT.connection,
        state: event.state,
        message: event.message,
        ollamaBaseUrl:
          typeof event.ollamaBaseUrl === "string" ? event.ollamaBaseUrl : undefined,
      };
    }
    return null;
  }

  if (record.type === AGENT_STREAM_EVENT.log) {
    const event = parsed as { event?: unknown };
    if (isAgentTimelineEvent(event.event))
      return { type: AGENT_STREAM_EVENT.log, event: event.event };
    return null;
  }

  if (record.type === AGENT_STREAM_EVENT.result) {
    const event = parsed as { result?: unknown };
    if (event.result && typeof event.result === "object")
      return {
        type: AGENT_STREAM_EVENT.result,
        result: event.result as AgentRunResponse,
      };
    return null;
  }

  if (record.type === AGENT_STREAM_EVENT.error) {
    const event = parsed as { error?: unknown };
    if (typeof event.error === "string")
      return { type: AGENT_STREAM_EVENT.error, error: event.error };
    return null;
  }

  return null;
}

async function readJsonError(response: Response): Promise<string | undefined> {
  const payload = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;
  return payload?.error;
}
