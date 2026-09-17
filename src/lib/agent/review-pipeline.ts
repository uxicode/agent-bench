import { RunnableLambda, RunnableSequence } from "@langchain/core/runnables";
import {
  REVIEW_ANALYZER_TEMPERATURE,
  REVIEW_REPORTER_TEMPERATURE,
} from "@/constants/agent";
import {
  MESSAGE_ROLE,
  OLLAMA_KEEP_ALIVE_UNLOAD,
  REVIEW_PIPELINE_MODELS,
} from "@/constants/ollama";
import { extractJsonObject } from "@/lib/agent/parse-model-json";
import {
  buildAnalysisSystemPrompt,
  buildAnalysisUserPrompt,
  buildReportSystemPrompt,
  buildReportUserPrompt,
} from "@/lib/agent/prompts";
import { createChatOllama } from "@/lib/ollama/client";
import { getChunkText, toLangChainMessages } from "@/lib/ollama/messages";
import {
  ModelRunTimeoutError,
  isDeadlineAbort,
  throwIfAborted,
} from "@/lib/ollama/timeout";
import { unloadOllamaModel } from "@/lib/ollama/unload";
import type { ChatMessage } from "@/types/chat";
import type {
  CodeAnalysisFinding,
  CodeAnalysisNotes,
  ReviewModelClient,
  ReviewPipelineDeps,
  ReviewPipelineInput,
  ReviewPipelineResult,
} from "@/types/agent";

export type ReviewPipelineStage = "analyzing" | "unloading" | "reporting";

export interface CreateReviewPipelineOptions {
  signal?: AbortSignal;
  onStage?: (stage: ReviewPipelineStage) => void;
  deps?: ReviewPipelineDeps;
}

interface AnalyzedReview extends ReviewPipelineInput {
  analysis: CodeAnalysisNotes;
}

export function createReviewPipeline(options: CreateReviewPipelineOptions = {}) {
  const analyzer =
    options.deps?.analyzer ??
    createDefaultModelClient(
      REVIEW_PIPELINE_MODELS.analyzer,
      REVIEW_ANALYZER_TEMPERATURE,
      options.signal,
    );
  const reporter =
    options.deps?.reporter ??
    createDefaultModelClient(
      REVIEW_PIPELINE_MODELS.reporter,
      REVIEW_REPORTER_TEMPERATURE,
      options.signal,
    );
  const unloadModel =
    options.deps?.unloadModel ??
    ((model: string) => unloadOllamaModel(model, { signal: options.signal }));

  const analyze = RunnableLambda.from(
    async (input: ReviewPipelineInput): Promise<AnalyzedReview> => {
      throwIfAborted(options.signal);
      options.onStage?.("analyzing");
      const raw = await analyzer.invoke([
        systemMessage(buildAnalysisSystemPrompt()),
        userMessage(buildAnalysisUserPrompt(input)),
      ]);
      return {
        ...input,
        analysis: parseAnalysisNotes(raw),
      };
    },
  );

  const unloadAnalyzer = RunnableLambda.from(
    async (input: AnalyzedReview): Promise<AnalyzedReview> => {
      throwIfAborted(options.signal);
      options.onStage?.("unloading");
      await unloadModel(REVIEW_PIPELINE_MODELS.analyzer);
      return input;
    },
  );

  const writeReport = RunnableLambda.from(
    async (input: AnalyzedReview): Promise<ReviewPipelineResult> => {
      throwIfAborted(options.signal);
      options.onStage?.("reporting");
      const report = await reporter.invoke([
        systemMessage(buildReportSystemPrompt()),
        userMessage(
          buildReportUserPrompt({
            filename: input.filename,
            sourceCode: input.sourceCode,
            analysisJson: JSON.stringify(input.analysis),
            instruction: input.instruction,
          }),
        ),
      ]);
      return {
        analysis: input.analysis,
        report: report.trim(),
      };
    },
  );

  return RunnableSequence.from(
    [analyze, unloadAnalyzer, writeReport],
    "code-review-pipeline",
  );
}

export function parseAnalysisNotes(text: string): CodeAnalysisNotes {
  try {
    const parsed = JSON.parse(extractJsonObject(text)) as unknown;
    return normalizeAnalysisNotes(parsed, text);
  } catch {
    return {
      summary: text.trim() || "기술 분석을 파싱하지 못했습니다.",
      findings: [],
      risks: [],
      suggestions: [],
    };
  }
}

function normalizeAnalysisNotes(
  parsed: unknown,
  fallback: string,
): CodeAnalysisNotes {
  if (!parsed || typeof parsed !== "object") {
    return {
      summary: fallback.trim(),
      findings: [],
      risks: [],
      suggestions: [],
    };
  }

  const record = parsed as {
    summary?: unknown;
    findings?: unknown;
    risks?: unknown;
    suggestions?: unknown;
  };

  return {
    summary:
      typeof record.summary === "string" && record.summary.trim()
        ? record.summary.trim()
        : fallback.trim() || "요약 없음",
    findings: Array.isArray(record.findings)
      ? record.findings.map(toFinding).filter((item): item is CodeAnalysisFinding =>
          Boolean(item),
        )
      : [],
    risks: toStringList(record.risks),
    suggestions: toStringList(record.suggestions),
  };
}

function toFinding(value: unknown): CodeAnalysisFinding | null {
  if (!value || typeof value !== "object") return null;
  const item = value as {
    severity?: unknown;
    title?: unknown;
    detail?: unknown;
    location?: unknown;
  };
  if (typeof item.title !== "string" || typeof item.detail !== "string")
    return null;

  return {
    severity: toSeverity(item.severity),
    title: item.title,
    detail: item.detail,
    location: typeof item.location === "string" ? item.location : undefined,
  };
}

function toSeverity(value: unknown): CodeAnalysisFinding["severity"] {
  if (value === "high" || value === "medium" || value === "low") return value;
  return "medium";
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function createDefaultModelClient(
  model: string,
  temperature: number,
  signal?: AbortSignal,
): ReviewModelClient {
  return {
    async invoke(messages) {
      throwIfAborted(signal);
      const chat = createChatOllama(
        {
          model,
          temperature,
          keepAlive: OLLAMA_KEEP_ALIVE_UNLOAD,
        },
        signal,
      );
      try {
        const ai = await chat.invoke(toLangChainMessages(asChatMessages(messages)), {
          signal,
        });
        return getChunkText(ai.content);
      } catch (error) {
        if (isDeadlineAbort(error, signal)) throw new ModelRunTimeoutError();
        throw error;
      }
    },
  };
}

function asChatMessages(
  messages: { role: string; content: string }[],
): ChatMessage[] {
  return messages.map((message) => ({
    role: message.role as ChatMessage["role"],
    content: message.content,
  }));
}

function systemMessage(content: string): ChatMessage {
  return { role: MESSAGE_ROLE.system, content };
}

function userMessage(content: string): ChatMessage {
  return { role: MESSAGE_ROLE.user, content };
}
