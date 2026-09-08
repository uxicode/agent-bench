"use client";

import { useEffect, useMemo, useState } from "react";
import { AgentPlayground } from "@/components/agent-playground/AgentPlayground";
import { ChatPlayground } from "@/components/chat-playground/ChatPlayground";
import type { OllamaHealth } from "@/types/chat";

const PLAYGROUND_TAB = {
  chat: "chat",
  agent: "agent",
} as const;

type PlaygroundTab = (typeof PLAYGROUND_TAB)[keyof typeof PLAYGROUND_TAB];

export function Playground() {
  const [tab, setTab] = useState<PlaygroundTab>(PLAYGROUND_TAB.chat);
  const [health, setHealth] = useState<OllamaHealth | null>(null);

  useEffect(() => {
    async function loadHealth() {
      try {
        const response = await fetch("/api/health");
        const data = (await response.json()) as OllamaHealth;
        setHealth(data);
      } catch {
        setHealth(null);
      }
    }

    void loadHealth();
  }, []);

  const statusLabel = useMemo(() => {
    if (!health) return "상태 확인 중";
    if (!health.isReady) return health.errorMessage ?? "Ollama 연결 실패";
    return `준비됨 · ${health.models.length}개 모델`;
  }, [health]);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
        <header className="mb-6">
          <p className="text-sm font-medium tracking-wide text-zinc-500 uppercase">
            LangChain + Ollama
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Playground
          </h1>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            Chat은 로컬 모델과 대화하고, Agent는 입력한 코드나 파일을 테스트·최적화·리팩터링합니다.
          </p>
          <p
            className={`mt-4 inline-flex rounded-full px-3 py-1 text-xs font-medium ${
              health?.isReady
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
            }`}
          >
            {statusLabel}
          </p>
        </header>

        <div className="mb-6 flex gap-2">
          <TabButton
            isActive={tab === PLAYGROUND_TAB.chat}
            onClick={() => setTab(PLAYGROUND_TAB.chat)}
          >
            Chat
          </TabButton>
          <TabButton
            isActive={tab === PLAYGROUND_TAB.agent}
            onClick={() => setTab(PLAYGROUND_TAB.agent)}
          >
            Agent
          </TabButton>
        </div>

        {tab === PLAYGROUND_TAB.chat ? (
          <ChatPlayground showChrome={false} health={health} />
        ) : (
          <AgentPlayground health={health} />
        )}
      </main>
    </div>
  );
}

function TabButton({
  isActive,
  onClick,
  children,
}: {
  isActive: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 rounded-full px-4 text-sm font-medium ${
        isActive
          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
          : "bg-white text-zinc-600 ring-1 ring-black/[.08] dark:bg-zinc-950 dark:text-zinc-300 dark:ring-white/[.12]"
      }`}
    >
      {children}
    </button>
  );
}
