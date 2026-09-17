import { describe, expect, it } from "vitest";
import { AGENT_STATUS } from "@/constants/agent";
import {
  consumeAgentRunStream,
  encodeAgentStreamEvent,
  parseAgentStreamLine,
} from "@/lib/agent/run-stream";
import { AGENT_STREAM_EVENT } from "@/types/agent";
import type { AgentRunResponse } from "@/types/agent";

const RESULT: AgentRunResponse = {
  runId: "run-1",
  taskId: "task-1",
  status: AGENT_STATUS.succeeded,
  attempts: 2,
  timeline: [
    {
      status: AGENT_STATUS.loadingSource,
      at: "2026-09-17T00:00:00.000Z",
      message: "소스를 읽습니다.",
    },
  ],
  stdoutExcerpt: "",
  diff: [],
  report: "ok",
};

describe("run-stream", () => {
  it("연결·로그 라인을 파싱한다", () => {
    const connection = parseAgentStreamLine(
      encodeAgentStreamEvent({
        type: AGENT_STREAM_EVENT.connection,
        state: "streaming",
        message: "Ollama에 연결했습니다.",
        ollamaBaseUrl: "http://127.0.0.1:11434",
      }),
    );
    const log = parseAgentStreamLine(
      encodeAgentStreamEvent({
        type: AGENT_STREAM_EVENT.log,
        event: RESULT.timeline[0],
      }),
    );

    expect(connection).toMatchObject({
      type: "connection",
      state: "streaming",
    });
    expect(log).toMatchObject({
      type: "log",
      event: RESULT.timeline[0],
    });
  });

  it("NDJSON 스트림에서 최종 결과를 모은다", async () => {
    const body = [
      encodeAgentStreamEvent({
        type: AGENT_STREAM_EVENT.connection,
        state: "streaming",
        message: "연결",
      }),
      encodeAgentStreamEvent({
        type: AGENT_STREAM_EVENT.log,
        event: RESULT.timeline[0],
      }),
      encodeAgentStreamEvent({
        type: AGENT_STREAM_EVENT.result,
        result: RESULT,
      }),
    ].join("");

    const received: string[] = [];
    const response = new Response(body, {
      status: 200,
      headers: { "Content-Type": "application/x-ndjson" },
    });
    const result = await consumeAgentRunStream(response, (event) => {
      received.push(event.type);
    });

    expect(received).toEqual(["connection", "log", "result"]);
    expect(result.report).toBe("ok");
  });

  it("JSON 오류 응답을 메시지로 던진다", async () => {
    const response = new Response(JSON.stringify({ error: "코드를 입력하세요." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });

    await expect(consumeAgentRunStream(response, () => undefined)).rejects.toThrow(
      "코드를 입력하세요.",
    );
  });
});
