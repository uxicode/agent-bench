"use client";

import {
  isAllowedOllamaModel,
  OLLAMA_MODEL_OPTIONS,
  type OllamaModelName,
} from "@/constants/ollama";

interface ModelSelectProps {
  value: OllamaModelName;
  isDisabled?: boolean;
  onChange: (model: OllamaModelName) => void;
}

export function ModelSelect({ value, isDisabled = false, onChange }: ModelSelectProps) {
  return (
    <label className="inline-flex items-center gap-2">
      <span className="sr-only">모델</span>
      <select
        value={value}
        disabled={isDisabled}
        onChange={(event) => {
          if (isAllowedOllamaModel(event.target.value))
            onChange(event.target.value);
        }}
        className="h-7 rounded-full border border-black/[.08] bg-white px-3 text-xs font-medium text-zinc-700 outline-none focus:border-zinc-400 dark:border-white/[.12] dark:bg-zinc-950 dark:text-zinc-200"
      >
        {OLLAMA_MODEL_OPTIONS.map((model) => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </select>
    </label>
  );
}
