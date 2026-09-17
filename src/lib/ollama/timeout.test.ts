import { describe, expect, it } from "vitest";
import {
  ModelRunTimeoutError,
  combineAbortSignals,
  createDeadlineSignal,
  isAbortError,
  isDeadlineAbort,
  throwIfAborted,
} from "@/lib/ollama/timeout";

describe("ollama timeout", () => {
  it("이미 abort된 시그널을 합치면 바로 abort된다", () => {
    const aborted = AbortSignal.abort();
    const combined = combineAbortSignals(aborted, new AbortController().signal);
    expect(combined.aborted).toBe(true);
  });

  it("부모 시그널이 abort되면 deadline도 abort된다", () => {
    const parent = new AbortController();
    const signal = createDeadlineSignal(60_000, parent.signal);
    expect(signal.aborted).toBe(false);
    parent.abort();
    expect(signal.aborted).toBe(true);
  });

  it("AbortError와 TimeoutError를 인식한다", () => {
    expect(isAbortError({ name: "AbortError", message: "aborted" })).toBe(true);
    expect(isAbortError({ name: "TimeoutError", message: "timeout" })).toBe(true);
    expect(isAbortError(new ModelRunTimeoutError())).toBe(true);
    expect(isAbortError(new Error("다른 오류"))).toBe(false);
  });

  it("abort된 시그널이면 timeout 에러를 던진다", () => {
    expect(() => throwIfAborted(AbortSignal.abort())).toThrow(ModelRunTimeoutError);
    expect(() => throwIfAborted(undefined)).not.toThrow();
  });

  it("시그널 abort면 deadline으로 본다", () => {
    expect(isDeadlineAbort(new Error("x"), AbortSignal.abort())).toBe(true);
    expect(isDeadlineAbort(new Error("x"))).toBe(false);
  });
});
