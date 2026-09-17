import { MODEL_RUN_TIMEOUT_MESSAGE } from "@/constants/timeout";

export class ModelRunTimeoutError extends Error {
  constructor(message = MODEL_RUN_TIMEOUT_MESSAGE) {
    super(message);
    this.name = "ModelRunTimeoutError";
  }
}

export function combineAbortSignals(
  ...signals: (AbortSignal | undefined)[]
): AbortSignal {
  const controller = new AbortController();
  const active = signals.filter((signal): signal is AbortSignal =>
    Boolean(signal),
  );

  for (const signal of active) {
    if (signal.aborted) {
      controller.abort();
      return controller.signal;
    }

    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  return controller.signal;
}

export function createDeadlineSignal(
  timeoutMs: number,
  parent?: AbortSignal,
): AbortSignal {
  return combineAbortSignals(AbortSignal.timeout(timeoutMs), parent);
}

export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  const message = "message" in error ? String(error.message) : "";
  return (
    name === "AbortError" ||
    name === "TimeoutError" ||
    name === "ModelRunTimeoutError" ||
    message.toLowerCase().includes("aborted") ||
    message.toLowerCase().includes("abort")
  );
}

export function isDeadlineAbort(
  error: unknown,
  signal?: AbortSignal,
): boolean {
  return signal?.aborted === true || error instanceof ModelRunTimeoutError || isAbortError(error);
}

export function abortableFetch(signal: AbortSignal): typeof fetch {
  return (input, init) =>
    fetch(input, {
      ...init,
      signal: combineAbortSignals(signal, init?.signal ?? undefined),
    });
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new ModelRunTimeoutError();
}
