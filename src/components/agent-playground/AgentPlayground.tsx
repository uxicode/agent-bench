"use client";

import { FormEvent, useMemo, useState } from "react";
import { AGENT_CODE_SAMPLES } from "@/constants/agent-seeds";
import {
  AGENT_ACTION,
  AGENT_ACTION_LABEL,
  AGENT_SOURCE_KIND,
  AGENT_STATUS,
  AGENT_STATUS_LABEL,
  type AgentAction,
  type AgentSourceKind,
  type AgentStatus,
} from "@/constants/agent";
import { OLLAMA_MODELS, isOllamaModelInstalled } from "@/constants/ollama";
import type { AgentRunResponse } from "@/types/agent";
import type { OllamaHealth } from "@/types/chat";

interface AgentPlaygroundProps {
  health: OllamaHealth | null;
}

export function AgentPlayground({ health }: AgentPlaygroundProps) {
  const [action, setAction] = useState<AgentAction>(AGENT_ACTION.test);
  const [sourceKind, setSourceKind] = useState<AgentSourceKind>(
    AGENT_SOURCE_KIND.code,
  );
  const [code, setCode] = useState(AGENT_CODE_SAMPLES[0]?.code ?? "");
  const [path, setPath] = useState("");
  const [instruction, setInstruction] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AgentRunResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const isCoderReady = useMemo(() => {
    if (!health?.isReady) return false;
    return isOllamaModelInstalled(health.models, OLLAMA_MODELS.qwen25Coder);
  }, [health]);

  const status = result?.status ?? AGENT_STATUS.idle;
  const statusLabel = isLoading
    ? "실행 중"
    : AGENT_STATUS_LABEL[status as keyof typeof AGENT_STATUS_LABEL] ?? status;

  const canSubmit =
    sourceKind === AGENT_SOURCE_KIND.code ? Boolean(code.trim()) : Boolean(path.trim());

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || isLoading || !isCoderReady) return;

    setIsLoading(true);
    setErrorMessage("");
    setResult(null);

    try {
      const response = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          sourceKind,
          code: sourceKind === AGENT_SOURCE_KIND.code ? code.trim() : undefined,
          path: sourceKind === AGENT_SOURCE_KIND.path ? path.trim() : undefined,
          instruction: instruction.trim() || undefined,
        }),
      });
      const payload = (await response.json()) as AgentRunResponse & {
        error?: string;
      };

      if (!response.ok)
        throw new Error(payload.error ?? "에이전트 실행에 실패했습니다.");

      setResult(payload);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        함수·클래스·구문을 붙이거나 저장소 상대 경로를 지정하면
        qwen2.5-coder:7b가 테스트, 최적화, 리팩터링을 수행합니다.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {Object.values(AGENT_ACTION).map((value) => (
          <button
            key={value}
            type="button"
            disabled={isLoading}
            onClick={() => setAction(value)}
            className={chipClass(action === value)}
          >
            {AGENT_ACTION_LABEL[value]}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isLoading}
          onClick={() => setSourceKind(AGENT_SOURCE_KIND.code)}
          className={chipClass(sourceKind === AGENT_SOURCE_KIND.code)}
        >
          코드 입력
        </button>
        <button
          type="button"
          disabled={isLoading}
          onClick={() => setSourceKind(AGENT_SOURCE_KIND.path)}
          className={chipClass(sourceKind === AGENT_SOURCE_KIND.path)}
        >
          파일 경로
        </button>
      </div>

      {sourceKind === AGENT_SOURCE_KIND.code ? (
        <div className="mt-3 flex flex-wrap gap-2">
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
      ) : null}

      <p
        className={`mt-4 inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass(isLoading, status)}`}
      >
        {statusLabel}
        {result ? ` · ${result.attempts}회 시도 · ${result.taskId}` : ""}
      </p>

      {!isCoderReady ? (
        <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
          {OLLAMA_MODELS.qwen25Coder}가 없습니다. ollama pull{" "}
          {OLLAMA_MODELS.qwen25Coder}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-4 flex flex-1 flex-col gap-3">
        {sourceKind === AGENT_SOURCE_KIND.code ? (
          <label className="flex flex-1 flex-col gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            코드
            <textarea
              value={code}
              onChange={(event) => setCode(event.target.value)}
              disabled={isLoading}
              rows={12}
              spellCheck={false}
              className="min-h-48 flex-1 rounded-2xl border border-black/[.08] bg-white p-4 font-mono text-xs leading-5 text-zinc-900 outline-none focus:border-zinc-400 dark:border-white/[.12] dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>
        ) : (
          <label className="flex flex-col gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            파일 경로
            <input
              value={path}
              onChange={(event) => setPath(event.target.value)}
              disabled={isLoading}
              placeholder="src/lib/agent/error-hash.ts"
              className="h-12 rounded-full border border-black/[.08] bg-white px-5 font-mono text-sm outline-none focus:border-zinc-400 dark:border-white/[.12] dark:bg-zinc-950"
            />
          </label>
        )}
        <label className="flex flex-col gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          추가 지시 (선택)
          <input
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            disabled={isLoading}
            placeholder={instructionPlaceholder(action)}
            className="h-12 rounded-full border border-black/[.08] bg-white px-5 text-sm outline-none focus:border-zinc-400 dark:border-white/[.12] dark:bg-zinc-950"
          />
        </label>
        <button
          type="submit"
          disabled={isLoading || !canSubmit || !isCoderReady}
          className="h-12 rounded-full bg-foreground px-5 text-sm font-medium text-background disabled:opacity-40"
        >
          {isLoading ? "실행 중" : `${AGENT_ACTION_LABEL[action]} 실행`}
        </button>
      </form>

      {errorMessage ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      ) : null}

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

      <div className="space-y-2 rounded-2xl border border-black/[.08] bg-white p-4 dark:border-white/[.12] dark:bg-zinc-950">
        <h2 className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
          타임라인
        </h2>
        {result.timeline.map((event, index) => (
          <p key={`${event.at}-${index}`} className="text-sm text-zinc-700 dark:text-zinc-200">
            {event.attempt ? `#${event.attempt} ` : ""}
            {AGENT_STATUS_LABEL[event.status as keyof typeof AGENT_STATUS_LABEL] ??
              event.status}
            {" — "}
            {event.message}
          </p>
        ))}
      </div>

      <div className="rounded-2xl border border-black/[.08] bg-white p-4 dark:border-white/[.12] dark:bg-zinc-950">
        <h2 className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
          테스트 출력
        </h2>
        <pre className="mt-2 overflow-x-auto text-xs leading-5 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
          {result.stdoutExcerpt || "(없음)"}
        </pre>
      </div>

      <div className="rounded-2xl border border-black/[.08] bg-white p-4 dark:border-white/[.12] dark:bg-zinc-950">
        <h2 className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
          Diff
        </h2>
        {result.diff.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">변경된 파일이 없습니다.</p>
        ) : (
          result.diff.map((file) => (
            <article key={file.path} className="mt-3">
              <p className="text-xs font-medium text-zinc-500">{file.path}</p>
              <pre className="mt-1 overflow-x-auto text-xs leading-5 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                {file.after}
              </pre>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function chipClass(isActive: boolean): string {
  return `h-9 rounded-full px-3 text-xs font-medium disabled:opacity-40 ${
    isActive
      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
      : "bg-white text-zinc-700 ring-1 ring-black/[.08] dark:bg-zinc-950 dark:text-zinc-200 dark:ring-white/[.12]"
  }`;
}

function instructionPlaceholder(action: AgentAction): string {
  if (action === AGENT_ACTION.test) return "예: 경계값과 빈 입력을 꼭 검증";
  if (action === AGENT_ACTION.optimize) return "예: 이중 루프를 피하고 Map을 사용";
  return "예: 헬퍼를 추출하고 이름을 명확히";
}

function statusBadgeClass(isLoading: boolean, status: AgentStatus): string {
  if (isLoading)
    return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
  if (status === AGENT_STATUS.succeeded)
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
  if (
    status === AGENT_STATUS.failedMaxAttempts ||
    status === AGENT_STATUS.failedPolicy ||
    status === AGENT_STATUS.failedInfra
  )
    return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
  return "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200";
}
