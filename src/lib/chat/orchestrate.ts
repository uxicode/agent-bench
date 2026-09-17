import { RunnableLambda, RunnableSequence } from "@langchain/core/runnables";
import {
  CHAT_DECOMPOSE_TEMPERATURE,
  CHAT_ROUTE,
  CHAT_SUB_QUESTION_COUNT,
  CHAT_TOOLS_FALLBACK_ROUTE,
  CHAT_WORKER_TEMPERATURE,
  type ChatRoute,
} from "@/constants/chat";
import {
  CHAT_ORCHESTRATION_MODELS,
  MESSAGE_ROLE,
} from "@/constants/ollama";
import { extractJsonObject } from "@/lib/agent/parse-model-json";
import {
  buildDecomposeSystemPrompt,
  buildDecomposeUserPrompt,
  buildRouteSystemPrompt,
  buildRouteUserPrompt,
  buildSynthesizeSystemPrompt,
  buildSynthesizeUserPrompt,
  buildWorkerSystemPrompt,
  buildWorkerUserPrompt,
} from "@/lib/chat/prompts";
import { createChatOllama } from "@/lib/ollama/client";
import { getChunkText, toLangChainMessages } from "@/lib/ollama/messages";
import {
  ModelRunTimeoutError,
  isDeadlineAbort,
  throwIfAborted,
} from "@/lib/ollama/timeout";
import { unloadOllamaModel } from "@/lib/ollama/unload";
import type {
  ChatMessage,
  ChatModelClient,
  ChatOrchestrateDeps,
  ChatOrchestrateInput,
  ChatOrchestrateResult,
  ChatSubQuestion,
  ChatWorkerAnswer,
  DecomposedChatQuestion,
} from "@/types/chat";

export interface CreateChatOrchestrationOptions {
  plannerModel?: string;
  workerModel?: string;
  signal?: AbortSignal;
  deps?: ChatOrchestrateDeps;
}

export function createChatOrchestration(
  options: CreateChatOrchestrationOptions = {},
) {
  const plannerModel = options.plannerModel ?? CHAT_ORCHESTRATION_MODELS.planner;
  const workerModel = options.workerModel ?? CHAT_ORCHESTRATION_MODELS.worker;
  const planner =
    options.deps?.planner ??
    createDefaultClient(plannerModel, CHAT_DECOMPOSE_TEMPERATURE, options.signal);
  const worker =
    options.deps?.worker ??
    createDefaultClient(workerModel, CHAT_WORKER_TEMPERATURE, options.signal);
  const unloadPlanner =
    options.deps?.unloadPlanner ??
    ((model: string) => unloadOllamaModel(model, { signal: options.signal }));

  const takeQuestion = RunnableLambda.from(
    async (input: ChatOrchestrateInput) => {
      throwIfAborted(options.signal);
      const question = lastUserQuestion(input.messages);
      if (!question) throw new Error("사용자 질문이 필요합니다.");
      return { ...input, question };
    },
  );

  const plan = RunnableLambda.from(
    async (
      input: ChatOrchestrateInput & { question: string },
    ): Promise<ChatOrchestrateResult> => {
      const history = priorHistory(input.messages);
      const route = await routeQuestion(planner, input.question, history);

      if (route === CHAT_ROUTE.direct) {
        await swapPlannerIfNeeded(
          plannerModel,
          workerModel,
          unloadPlanner,
        );
        return {
          question: input.question,
          route,
          answerMessages: input.messages,
        };
      }

      const decomposed = await decomposeQuestion(
        planner,
        input.question,
        history,
      );
      await swapPlannerIfNeeded(plannerModel, workerModel, unloadPlanner);

      const workerAnswers = await runWorkers(
        worker,
        input.question,
        decomposed,
        options.signal,
      );

      return {
        question: input.question,
        route,
        decomposed,
        workerAnswers,
        answerMessages: [
          { role: MESSAGE_ROLE.system, content: buildSynthesizeSystemPrompt() },
          ...history,
          {
            role: MESSAGE_ROLE.user,
            content: buildSynthesizeUserPrompt({
              question: input.question,
              goal: decomposed.goal,
              answers: workerAnswers,
            }),
          },
        ],
      };
    },
  );

  return RunnableSequence.from([takeQuestion, plan], "chat-orchestration");
}

export function lastUserQuestion(messages: ChatMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === MESSAGE_ROLE.user && message.content.trim())
      return message.content.trim();
  }
  return "";
}

export function priorHistory(messages: ChatMessage[]): ChatMessage[] {
  const last = messages.at(-1);
  if (last?.role === MESSAGE_ROLE.user) return messages.slice(0, -1);
  return messages;
}

export function parseChatRoute(text: string): ChatRoute {
  try {
    const parsed = JSON.parse(extractJsonObject(text)) as { route?: unknown };
    if (parsed.route === CHAT_ROUTE.direct) return CHAT_ROUTE.direct;
    if (parsed.route === CHAT_ROUTE.decompose) return CHAT_ROUTE.decompose;
    if (parsed.route === "tools") return CHAT_TOOLS_FALLBACK_ROUTE;
  } catch {
    return CHAT_ROUTE.direct;
  }
  return CHAT_ROUTE.direct;
}

export function parseDecomposedQuestion(
  text: string,
  fallbackQuestion: string,
): DecomposedChatQuestion {
  try {
    const parsed = JSON.parse(extractJsonObject(text)) as unknown;
    return normalizeDecomposedQuestion(parsed, fallbackQuestion);
  } catch {
    return fallbackDecomposedQuestion(fallbackQuestion);
  }
}

async function routeQuestion(
  planner: ChatModelClient,
  question: string,
  history: ChatMessage[],
): Promise<ChatRoute> {
  const raw = await planner.invoke([
    { role: MESSAGE_ROLE.system, content: buildRouteSystemPrompt() },
    {
      role: MESSAGE_ROLE.user,
      content: buildRouteUserPrompt({ question, history }),
    },
  ]);
  return parseChatRoute(raw);
}

async function decomposeQuestion(
  planner: ChatModelClient,
  question: string,
  history: ChatMessage[],
): Promise<DecomposedChatQuestion> {
  const raw = await planner.invoke([
    { role: MESSAGE_ROLE.system, content: buildDecomposeSystemPrompt() },
    {
      role: MESSAGE_ROLE.user,
      content: buildDecomposeUserPrompt({ question, history }),
    },
  ]);
  return parseDecomposedQuestion(raw, question);
}

async function runWorkers(
  worker: ChatModelClient,
  question: string,
  decomposed: DecomposedChatQuestion,
  signal?: AbortSignal,
): Promise<ChatWorkerAnswer[]> {
  const answers: ChatWorkerAnswer[] = [];
  for (const item of decomposed.subQuestions) {
    throwIfAborted(signal);
    try {
      const answer = await worker.invoke([
        { role: MESSAGE_ROLE.system, content: buildWorkerSystemPrompt() },
        {
          role: MESSAGE_ROLE.user,
          content: buildWorkerUserPrompt({
            question,
            subQuestion: item.question,
          }),
        },
      ]);
      answers.push({ question: item.question, answer: answer.trim() });
    } catch (error) {
      if (isDeadlineAbort(error, signal)) throw error;
      answers.push({ question: item.question, answer: "" });
    }
  }
  return answers;
}

async function swapPlannerIfNeeded(
  plannerModel: string,
  workerModel: string,
  unloadPlanner: (model: string) => Promise<void>,
): Promise<void> {
  if (plannerModel === workerModel) return;
  await unloadPlanner(plannerModel);
}

function normalizeDecomposedQuestion(
  parsed: unknown,
  fallbackQuestion: string,
): DecomposedChatQuestion {
  if (!parsed || typeof parsed !== "object")
    return fallbackDecomposedQuestion(fallbackQuestion);

  const record = parsed as { goal?: unknown; subQuestions?: unknown };
  const rawItems = Array.isArray(record.subQuestions)
    ? record.subQuestions.filter((item): item is string => typeof item === "string")
    : [];
  const filled = fillSubQuestions(rawItems, fallbackQuestion);
  const goal =
    typeof record.goal === "string" && record.goal.trim()
      ? record.goal.trim()
      : fallbackQuestion;

  return {
    goal,
    subQuestions: toSubQuestions(filled),
  };
}

function fallbackDecomposedQuestion(question: string): DecomposedChatQuestion {
  return {
    goal: question,
    subQuestions: toSubQuestions(fillSubQuestions([], question)),
  };
}

function fillSubQuestions(items: string[], question: string): string[] {
  const cleaned = items.map((item) => item.trim()).filter(Boolean);
  const defaults = [
    `${question}의 핵심 의도는 무엇인가?`,
    `${question}을(를) 다룰 때 필요한 조건과 맥락은 무엇인가?`,
    `${question}에 대한 구체적 답 또는 다음 단계는 무엇인가?`,
  ];

  const merged = [...cleaned];
  for (const fallback of defaults) {
    if (merged.length >= CHAT_SUB_QUESTION_COUNT) break;
    if (!merged.includes(fallback)) merged.push(fallback);
  }

  return merged.slice(0, CHAT_SUB_QUESTION_COUNT);
}

function toSubQuestions(questions: string[]): ChatSubQuestion[] {
  return questions.map((question, index) => ({
    id: `q${index + 1}`,
    question,
  }));
}

function createDefaultClient(
  model: string,
  temperature: number,
  signal?: AbortSignal,
): ChatModelClient {
  return {
    async invoke(messages) {
      throwIfAborted(signal);
      const chat = createChatOllama({ model, temperature }, signal);
      try {
        const ai = await chat.invoke(toLangChainMessages(messages), { signal });
        return getChunkText(ai.content);
      } catch (error) {
        if (isDeadlineAbort(error, signal)) throw new ModelRunTimeoutError();
        throw error;
      }
    },
  };
}
