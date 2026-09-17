import { describe, expect, it } from "vitest";
import { CHAT_ROUTE } from "@/constants/chat";
import { CHAT_ORCHESTRATION_MODELS, MESSAGE_ROLE } from "@/constants/ollama";
import {
  createChatOrchestration,
  parseChatRoute,
  parseDecomposedQuestion,
} from "@/lib/chat/orchestrate";
import { buildDecomposeSystemPrompt } from "@/lib/chat/prompts";
import type { ChatModelClient } from "@/types/chat";

const QUESTION = "Ollama 연결과 LangChain 스트리밍을 비교해서 설명해줘";

function queuedPlanner(replies: string[]): ChatModelClient {
  return {
    async invoke() {
      return replies.shift() ?? "{}";
    },
  };
}

describe("chat orchestration", () => {
  it("direct면 워커를 호출하지 않고 원래 메시지를 그대로 둔다", async () => {
    let workerCalls = 0;
    const unloaded: string[] = [];
    const pipeline = createChatOrchestration({
      deps: {
        planner: queuedPlanner([JSON.stringify({ route: "direct" })]),
        worker: {
          async invoke() {
            workerCalls += 1;
            return "unused";
          },
        },
        async unloadPlanner(model) {
          unloaded.push(model);
        },
      },
    });

    const messages = [{ role: MESSAGE_ROLE.user, content: "안녕" }];
    const result = await pipeline.invoke({ messages });

    expect(result.route).toBe(CHAT_ROUTE.direct);
    expect(result.answerMessages).toEqual(messages);
    expect(workerCalls).toBe(0);
    expect(unloaded).toEqual([CHAT_ORCHESTRATION_MODELS.planner]);
  });

  it("decompose면 워커를 3번 호출하고 종합 프롬프트에 답을 넣는다", async () => {
    const workerQuestions: string[] = [];
    const pipeline = createChatOrchestration({
      deps: {
        planner: queuedPlanner([
          JSON.stringify({ route: "decompose" }),
          JSON.stringify({
            goal: "연결과 스트리밍 비교",
            subQuestions: [
              "Ollama는 무엇인가?",
              "로컬에서 어떻게 붙이나?",
              "스트리밍은 어디서 하나?",
            ],
          }),
        ]),
        worker: {
          async invoke(messages) {
            const last = messages.at(-1)?.content ?? "";
            workerQuestions.push(last);
            return `답:${workerQuestions.length}`;
          },
        },
        async unloadPlanner() {
          return;
        },
      },
    });

    const result = await pipeline.invoke({
      messages: [{ role: MESSAGE_ROLE.user, content: QUESTION }],
    });

    expect(result.route).toBe(CHAT_ROUTE.decompose);
    expect(workerQuestions).toHaveLength(3);
    expect(result.workerAnswers).toHaveLength(3);
    expect(result.answerMessages.at(-1)?.content).toContain("답:1");
    expect(result.answerMessages.at(-1)?.content).toContain("답:2");
    expect(result.answerMessages.at(-1)?.content).toContain("답:3");
  });

  it("tools 라우트는 decompose로 폴백한다", () => {
    expect(parseChatRoute('{"route":"tools"}')).toBe(CHAT_ROUTE.decompose);
    expect(parseChatRoute("아님")).toBe(CHAT_ROUTE.direct);
  });

  it("JSON이 아니면 기본 3개 하위 질문으로 채운다", () => {
    const decomposed = parseDecomposedQuestion("그냥 설명", "타입스크립트란?");
    expect(decomposed.subQuestions).toHaveLength(3);
    expect(decomposed.goal).toBe("타입스크립트란?");
    expect(buildDecomposeSystemPrompt()).toContain("정확히 3개");
  });
});
