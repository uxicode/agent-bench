"use client";

import { useEffect, useRef, useState } from "react";
import {
  AGENT_CONNECTION_LABEL,
  AGENT_STATUS,
  AGENT_STATUS_LABEL,
  REVIEW_PIPELINE_STEPS,
  type AgentConnectionState,
  type AgentStatus,
} from "@/constants/agent";
import { REVIEW_PIPELINE_MODELS } from "@/constants/ollama";
import type { AgentTimelineEvent } from "@/types/agent";
import type { OllamaHealth } from "@/types/chat";

interface ReviewProgressProps {
  health: OllamaHealth | null;
  connectionState: AgentConnectionState;
  connectionMessage: string;
  ollamaBaseUrl?: string;
  timeline: AgentTimelineEvent[];
  liveStatus: AgentStatus;
  isRunning: boolean;
  startedAt: number | null;
}

export function ReviewProgress({
  health,
  connectionState,
  connectionMessage,
  ollamaBaseUrl,
  timeline,
  liveStatus,
  isRunning,
  startedAt,
}: ReviewProgressProps) {
  const logRef = useRef<HTMLDivElement>(null);
  const elapsed = useElapsedLabel(startedAt, isRunning);
  const ollamaLabel = health?.isReady
    ? `연결됨 · ${ollamaBaseUrl ?? health.baseUrl}`
    : (health?.errorMessage ?? "확인되지 않음");

  useEffect(() => {
    const node = logRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [timeline]);

  return (
    <section className="mt-6 space-y-4 rounded-2xl border border-black/[.08] bg-white p-4 dark:border-white/[.12] dark:bg-zinc-950">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
          진행 상태
        </h2>
        {isRunning ? (
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
        ) : null}
      </div>

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <StatusRow
          label="API"
          value={`${AGENT_CONNECTION_LABEL[connectionState]} · ${elapsed}`}
        />
        <StatusRow label="Ollama" value={ollamaLabel} />
        <StatusRow
          label="단계"
          value={
            AGENT_STATUS_LABEL[liveStatus as keyof typeof AGENT_STATUS_LABEL] ??
            liveStatus
          }
        />
        <StatusRow label="활성 모델" value={activeModelLabel(liveStatus)} />
      </dl>

      {connectionMessage ? (
        <p className="text-xs text-zinc-500">{connectionMessage}</p>
      ) : null}

      <ol className="flex flex-wrap gap-2">
        {REVIEW_PIPELINE_STEPS.map((step) => (
          <li
            key={step.status}
            className={`rounded-full px-3 py-1 text-xs font-medium ${stepClass(step.status, liveStatus, timeline)}`}
          >
            {step.label}
          </li>
        ))}
      </ol>

      <div>
        <h3 className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
          로그
        </h3>
        <div
          ref={logRef}
          className="mt-2 max-h-48 overflow-y-auto rounded-xl bg-zinc-50 p-3 font-mono text-xs leading-5 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          {timeline.length === 0 ? (
            <p className="text-zinc-400">실행하면 단계별 로그가 여기에 쌓입니다.</p>
          ) : (
            timeline.map((event, index) => (
              <p key={`${event.at}-${index}`}>
                <span className="text-zinc-400">{formatClock(event.at)} </span>
                <span className="text-zinc-500">
                  {AGENT_STATUS_LABEL[event.status as keyof typeof AGENT_STATUS_LABEL] ??
                    event.status}
                </span>
                {" — "}
                {event.message}
              </p>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-xl bg-zinc-50 px-3 py-2 dark:bg-zinc-900">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="text-right text-xs font-medium text-zinc-800 dark:text-zinc-100">
        {value}
      </dd>
    </div>
  );
}

function activeModelLabel(status: AgentStatus): string {
  if (status === AGENT_STATUS.analyzingCode) return REVIEW_PIPELINE_MODELS.analyzer;
  if (status === AGENT_STATUS.unloadingModel)
    return `${REVIEW_PIPELINE_MODELS.analyzer} 언로드`;
  if (status === AGENT_STATUS.writingReport) return REVIEW_PIPELINE_MODELS.reporter;
  if (status === AGENT_STATUS.succeeded) return "없음";
  return "대기";
}

function stepClass(
  stepStatus: AgentStatus,
  liveStatus: AgentStatus,
  timeline: AgentTimelineEvent[],
): string {
  const seen = timeline.some((event) => event.status === stepStatus);
  const isCurrent = liveStatus === stepStatus;
  if (isCurrent)
    return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
  if (seen || liveStatus === AGENT_STATUS.succeeded)
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
  if (liveStatus === AGENT_STATUS.failedInfra && seen)
    return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
  return "bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400";
}

function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--:--:--";
  return date.toLocaleTimeString("ko-KR", { hour12: false });
}

function useElapsedLabel(startedAt: number | null, isRunning: boolean): string {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isRunning || startedAt === null) return undefined;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isRunning, startedAt]);

  if (startedAt === null) return "0:00";
  const total = Math.max(0, Math.floor(((isRunning ? now : Date.now()) - startedAt) / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
