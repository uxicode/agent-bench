"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_OLLAMA_MODEL,
  isAllowedOllamaModel,
  isOllamaModelInstalled,
  MESSAGE_ROLE,
  OLLAMA_MODEL_OPTIONS,
  OLLAMA_MODELS,
  type OllamaModelName,
} from "@/constants/ollama";
import type { ChatMessage, OllamaHealth } from "@/types/chat";

interface ChatPlaygroundProps {
  showChrome?: boolean;
  health?: OllamaHealth | null;
}

/**
 * 로컬 Ollama 모델과 스트리밍 채팅을 확인하는 개발용 플레이그라운드.
 * 모델 호출은 `/api/chat` Route Handler에서만 수행한다.
 */
export function ChatPlayground({
  showChrome = true,
  health: healthProp,
}: ChatPlaygroundProps) {
  /** 지금까지 주고받은 대화 목록 */
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  /** 이번 요청에 사용할 Ollama 모델 */
  const [selectedModel, setSelectedModel] = useState<OllamaModelName>(
    DEFAULT_OLLAMA_MODEL,
  );
  /** 입력창에 작성 중인 텍스트 */
  const [input, setInput] = useState("");
  /** 모델 응답 스트리밍 진행 여부 */
  const [isLoading, setIsLoading] = useState(false);
  /** Ollama 연결·모델 준비 상태 */
  const [internalHealth, setInternalHealth] = useState<OllamaHealth | null>(
    null,
  );
  const health = healthProp === undefined ? internalHealth : healthProp;
  /** 요청 실패 여부 */
  const [hasError, setHasError] = useState(false);
  /** 사용자에게 보여줄 오류 메시지 */
  const [errorMessage, setErrorMessage] = useState("");
  /** 메시지 목록 스크롤 컨테이너 */
  const listRef = useRef<HTMLDivElement>(null);

  /**
   * 마운트 시 Ollama 서버와 설정된 모델이 준비됐는지 조회한다.
   */
  useEffect(() => {
    if (healthProp !== undefined) return;

    async function loadHealth() {
      try {
        const response = await fetch("/api/health");
        const data = (await response.json()) as OllamaHealth;
        setInternalHealth(data);
      } catch {
        setInternalHealth(null);
      }
    }

    void loadHealth();
  }, [healthProp]);

  /**
   * 새 메시지가 추가되면 목록을 맨 아래로 스크롤한다.
   */
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  /**
   * 헤더 배지에 표시할 Ollama 상태 문구를 만든다.
   */
  const isSelectedModelInstalled = useMemo(() => {
    if (!health) return false;
    return isOllamaModelInstalled(health.models, selectedModel);
  }, [health, selectedModel]);

  const statusLabel = useMemo(() => {
    if (!health) return "상태 확인 중";
    if (!health.isReady) return health.errorMessage ?? "Ollama 연결 실패";
    if (!isSelectedModelInstalled)
      return `모델 "${selectedModel}"이(가) 없습니다. ollama pull ${selectedModel}`;
    return `준비됨 · ${selectedModel}`;
  }, [health, isSelectedModelInstalled, selectedModel]);

  const isEmbedModel = selectedModel === OLLAMA_MODELS.nomicEmbedText;

  /**
   * 사용자 메시지를 `/api/chat`으로 보내고,
   * 응답 스트림을 토큰 단위로 누적해 화면에 반영한다.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = input.trim();
    if (!content || isLoading) return;

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: MESSAGE_ROLE.user, content },
    ];

    setInput("");
    setIsLoading(true);
    setHasError(false);
    setErrorMessage("");
    // 빈 assistant 버블을 먼저 넣어 스트리밍 자리를 확보한다.
    setMessages([
      ...nextMessages,
      { role: MESSAGE_ROLE.assistant, content: "" },
    ]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, model: selectedModel }),
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "채팅 요청에 실패했습니다.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      // ReadableStream 청크를 디코드하며 assistant 메시지를 갱신한다.
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        assistantContent += decoder.decode(value, { stream: true });
        setMessages([
          ...nextMessages,
          { role: MESSAGE_ROLE.assistant, content: assistantContent },
        ]);
      }
    } catch (error) {
      setHasError(true);
      setErrorMessage(
        error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
      );
      // 실패한 assistant 버블은 제거하고 사용자 메시지만 남긴다.
      setMessages(nextMessages);
    } finally {
      setIsLoading(false);
    }
  }

  const chatBody = (
    <>
        {!showChrome ? (
          <p
            className={`mb-4 inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium ${
              health?.isReady && isSelectedModelInstalled
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
            }`}
          >
            {statusLabel}
          </p>
        ) : null}
        {/* 대화 목록. 사용자 메시지는 오른쪽, assistant는 왼쪽 */}
        <div
          ref={listRef}
          className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-black/[.08] bg-white p-5 dark:border-white/[.12] dark:bg-zinc-950"
        >
          {messages.length === 0 ? (
            <p className="text-sm text-zinc-500">
              메시지를 보내면 {selectedModel}이(가) 응답합니다.
            </p>
          ) : (
            messages.map((message, index) => (
              <article
                key={`${message.role}-${index}`}
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 whitespace-pre-wrap ${
                  message.role === MESSAGE_ROLE.user
                    ? "ml-auto bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                }`}
              >
                {message.content || (isLoading ? "생성 중..." : "")}
              </article>
            ))
          )}
        </div>

        {hasError ? (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400">
            {errorMessage}
          </p>
        ) : null}

        {/* 모델 선택, 메시지 입력 및 전송 */}
        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
          <label className="flex flex-col gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            모델
            <select
              value={selectedModel}
              onChange={(event) => {
                if (isAllowedOllamaModel(event.target.value))
                  setSelectedModel(event.target.value);
              }}
              disabled={isLoading}
              className="h-11 rounded-full border border-black/[.08] bg-white px-4 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-white/[.12] dark:bg-zinc-950 dark:text-zinc-100"
            >
              {OLLAMA_MODEL_OPTIONS.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </label>
          {isEmbedModel ? (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              nomic-embed-text는 임베딩 모델입니다. 채팅 응답이 실패할 수
              있습니다.
            </p>
          ) : null}
          <div className="flex gap-3">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="로컬 모델에게 질문을 입력하세요"
              className="h-12 flex-1 rounded-full border border-black/[.08] bg-white px-5 text-sm outline-none focus:border-zinc-400 dark:border-white/[.12] dark:bg-zinc-950"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="h-12 rounded-full bg-foreground px-5 text-sm font-medium text-background disabled:opacity-40"
            >
              {isLoading ? "전송 중" : "보내기"}
            </button>
          </div>
        </form>
    </>
  );

  if (!showChrome) return <div className="flex flex-1 flex-col">{chatBody}</div>;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
        <header className="mb-8">
          <p className="text-sm font-medium tracking-wide text-zinc-500 uppercase">
            LangChain + Ollama
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Playground
          </h1>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            `@langchain/core`와 `@langchain/ollama`를 사용하여 서버 Route
            Handler에서 로컬 Ollama 모델을 실행하고, 응답을 스트리밍
          </p>
          <p
            className={`mt-4 inline-flex rounded-full px-3 py-1 text-xs font-medium ${
              health?.isReady && isSelectedModelInstalled
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
            }`}
          >
            {statusLabel}
          </p>
        </header>
        {chatBody}
      </main>
    </div>
  );
}
