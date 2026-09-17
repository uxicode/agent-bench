"use client";

import { FormEvent, useMemo, useState } from "react";
import { AGENT_CODE_SAMPLES } from "@/constants/agent-seeds";
import {
  AGENT_ACTION,
  AGENT_ACTION_LABEL,
  AGENT_CONNECTION_STATE,
  AGENT_SOURCE_KIND,
  AGENT_STATUS,
  AGENT_STATUS_LABEL,
  type AgentConnectionState,
  type AgentStatus,
} from "@/constants/agent";
import {
  REVIEW_PIPELINE_MODELS,
  missingReviewPipelineModels,
} from "@/constants/ollama";
import {
  MODEL_RUN_TIMEOUT_MESSAGE,
  MODEL_RUN_TIMEOUT_MS,
} from "@/constants/timeout";
import { consumeAgentRunStream } from "@/lib/agent/run-stream";
import { isAbortError } from "@/lib/ollama/timeout";
import { AGENT_STREAM_EVENT } from "@/types/agent";
import type { AgentRunResponse, AgentTimelineEvent } from "@/types/agent";
import type { OllamaHealth } from "@/types/chat";
import {
  FileSourcePicker,
  type SourceFileItem,
} from "@/components/agent-playground/file-source-picker";
import { ReviewProgress } from "@/components/agent-playground/review-progress";

interface AgentPlaygroundProps {
  health: OllamaHealth | null;
}

export function AgentPlayground({ health }: AgentPlaygroundProps) {
  const [code, setCode] = useState(AGENT_CODE_SAMPLES[0]?.code ?? "");
  const [sourceFiles, setSourceFiles] = useState<SourceFileItem[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AgentRunResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [timeline, setTimeline] = useState<AgentTimelineEvent[]>([]);
  const [connectionState, setConnectionState] = useState<AgentConnectionState>(
    AGENT_CONNECTION_STATE.idle,
  );
  const [connectionMessage, setConnectionMessage] = useState("실행 전입니다.");
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState(health?.baseUrl);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const missingModels = useMemo(() => {
    if (!health?.isReady) return [REVIEW_PIPELINE_MODELS.analyzer, REVIEW_PIPELINE_MODELS.reporter];
    return missingReviewPipelineModels(health.models);
  }, [health]);

  const isPipelineReady = Boolean(health?.isReady) && missingModels.length === 0;
  const liveStatus =
    timeline.at(-1)?.status ?? result?.status ?? AGENT_STATUS.idle;
  const statusLabel = isLoading
    ? (AGENT_STATUS_LABEL[liveStatus as keyof typeof AGENT_STATUS_LABEL] ?? "실행 중")
    : AGENT_STATUS_LABEL[liveStatus as keyof typeof AGENT_STATUS_LABEL] ?? liveStatus;

  const selectedFile = sourceFiles.find((file) => file.id === selectedFileId);
  const canSubmit = Boolean(selectedFile) || Boolean(code.trim());

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || isLoading || !isPipelineReady) return;

    setIsLoading(true);
    setErrorMessage("");
    setResult(null);
    setTimeline([]);
    setStartedAt(Date.now());
    setConnectionState(AGENT_CONNECTION_STATE.connecting);
    setConnectionMessage("API 스트림을 연결합니다.");
    setOllamaBaseUrl(health?.baseUrl);

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), MODEL_RUN_TIMEOUT_MS);

    try {
      const response = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: AGENT_ACTION.review,
          ...buildSourcePayload(code, selectedFile),
          instruction: instruction.trim() || undefined,
        }),
        signal: controller.signal,
      });
      const payload = await consumeAgentRunStream(response, (event) => {
        if (event.type === AGENT_STREAM_EVENT.connection) {
          setConnectionState(event.state);
          setConnectionMessage(event.message);
          if (event.ollamaBaseUrl) setOllamaBaseUrl(event.ollamaBaseUrl);
          return;
        }
        if (event.type === AGENT_STREAM_EVENT.log)
          setTimeline((current) => [...current, event.event]);
      });

      setResult(payload);
      if (payload.timeline.length > 0) setTimeline(payload.timeline);
      if (payload.status === AGENT_STATUS.succeeded)
        setConnectionState(AGENT_CONNECTION_STATE.completed);
      if (payload.errorMessage === MODEL_RUN_TIMEOUT_MESSAGE)
        setErrorMessage(MODEL_RUN_TIMEOUT_MESSAGE);
    } catch (error) {
      setConnectionState(AGENT_CONNECTION_STATE.failed);
      setConnectionMessage(
        isAbortError(error)
          ? MODEL_RUN_TIMEOUT_MESSAGE
          : error instanceof Error
            ? error.message
            : "알 수 없는 오류가 발생했습니다.",
      );
      setErrorMessage(
        isAbortError(error)
          ? MODEL_RUN_TIMEOUT_MESSAGE
          : error instanceof Error
            ? error.message
            : "알 수 없는 오류가 발생했습니다.",
      );
    } finally {
      window.clearTimeout(timer);
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {REVIEW_PIPELINE_MODELS.analyzer}가 기술 분석을 끝낸 뒤 메모리에서 내려가고,
        {" "}{REVIEW_PIPELINE_MODELS.reporter}가 최종 리포트를 작성합니다.
      </p>

      <p
        className={`mt-4 inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass(isLoading, liveStatus)}`}
      >
        {statusLabel}
        {result ? ` · ${result.taskId}` : ""}
      </p>

      {!isPipelineReady ? (
        <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
          {missingModels.join(", ")}가 없습니다. ollama pull {missingModels.join(" && ollama pull ")}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-4 flex flex-1 flex-col gap-5">
        <div className="flex flex-col gap-2">
          <FileSourcePicker
            files={sourceFiles}
            selectedId={selectedFileId}
            isDisabled={isLoading}
            onChange={(files, nextSelectedId) => {
              setSourceFiles(files);
              setSelectedFileId(nextSelectedId);
            }}
          />
          {selectedFile?.content !== undefined ? (
            <p className="text-xs text-zinc-500">
              브라우저가 실제 경로를 주지 않아 파일 내용으로 실행합니다.
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {AGENT_CODE_SAMPLES.map((sample) => (
            <button
              key={sample.title}
              type="button"
              disabled={isLoading}
              onClick={() => setCode(sample.code)}
              className="h-8 rounded-full bg-white px-3 text-xs text-zinc-600 ring-1 ring-black/[.08] disabled:opacity-40 dark:bg-zinc-950 dark:text-zinc-300 dark:ring-white/[.12]"
            >
              예시 · {sample.title}
            </button>
          ))}
        </div>

        <label className="flex flex-1 flex-col gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          또는 코드 직접 입력
          <textarea
            value={code}
            onChange={(event) => setCode(event.target.value)}
            disabled={isLoading}
            rows={8}
            spellCheck={false}
            className="min-h-40 flex-1 rounded-2xl border border-black/[.08] bg-white p-4 font-mono text-xs leading-5 text-zinc-900 outline-none focus:border-zinc-400 dark:border-white/[.12] dark:bg-zinc-950 dark:text-zinc-100"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          추가 지시 (선택)
          <input
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            disabled={isLoading}
            placeholder="예: 보안과 성능 이슈를 우선 지적"
            className="h-12 rounded-full border border-black/[.08] bg-white px-5 text-sm outline-none focus:border-zinc-400 dark:border-white/[.12] dark:bg-zinc-950"
          />
        </label>
        <p className="text-xs text-zinc-500">
          실행이 2분을 넘기면 모델 호출과 API 연결을 자동으로 중단합니다.
        </p>
        <button
          type="submit"
          disabled={isLoading || !canSubmit || !isPipelineReady}
          className="h-12 rounded-full bg-foreground px-5 text-sm font-medium text-background disabled:opacity-40"
        >
          {isLoading ? "실행 중" : `${AGENT_ACTION_LABEL.review} 실행`}
        </button>
      </form>

      {errorMessage ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      ) : null}

      <ReviewProgress
        health={health}
        connectionState={connectionState}
        connectionMessage={connectionMessage}
        ollamaBaseUrl={ollamaBaseUrl}
        timeline={timeline}
        liveStatus={liveStatus}
        isRunning={isLoading}
        startedAt={startedAt}
      />

      {result ? <AgentResult result={result} /> : null}
    </div>
  );
}

function AgentResult({ result }: { result: AgentRunResponse }) {
  return (
    <section className="mt-6 space-y-4">
      {result.errorMessage ? (
        <p className="text-sm text-red-600 dark:text-red-400">
          {result.errorMessage}
        </p>
      ) : null}

      <div className="rounded-2xl border border-black/[.08] bg-white p-4 dark:border-white/[.12] dark:bg-zinc-950">
        <h2 className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
          코드리뷰 리포트
        </h2>
        <pre className="mt-2 overflow-x-auto text-sm leading-6 whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">
          {result.report || "(없음)"}
        </pre>
      </div>
    </section>
  );
}

function buildSourcePayload(code: string, selectedFile?: SourceFileItem) {
  if (selectedFile?.content !== undefined)
    return {
      sourceKind: AGENT_SOURCE_KIND.code,
      code: selectedFile.content,
      filename: selectedFile.name,
    };

  if (selectedFile?.path.trim())
    return { sourceKind: AGENT_SOURCE_KIND.path, path: selectedFile.path.trim() };

  return { sourceKind: AGENT_SOURCE_KIND.code, code: code.trim() };
}

function statusBadgeClass(isLoading: boolean, status: AgentStatus): string {
  if (isLoading)
    return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
  if (status === AGENT_STATUS.succeeded)
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
  if (status === AGENT_STATUS.failedInfra)
    return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
  return "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200";
}
