"use client";

import { DragEvent, useRef, useState } from "react";

export interface SourceFileItem {
  id: string;
  name: string;
  path: string;
  content?: string;
}

interface FileSourcePickerProps {
  files: SourceFileItem[];
  selectedId: string | null;
  isDisabled?: boolean;
  onChange: (files: SourceFileItem[], selectedId: string | null) => void;
}

export function FileSourcePicker({
  files,
  selectedId,
  isDisabled = false,
  onChange,
}: FileSourcePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [typedPath, setTypedPath] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  function selectFile(next: SourceFileItem, current = files) {
    const exists = current.find((item) => item.id === next.id);
    const nextFiles = exists
      ? current.map((item) => (item.id === next.id ? next : item))
      : [...current, next];
    onChange(nextFiles, next.id);
  }

  function removeFile(id: string) {
    const nextFiles = files.filter((item) => item.id !== id);
    const nextSelected =
      selectedId === id ? (nextFiles[0]?.id ?? null) : selectedId;
    onChange(nextFiles, nextSelected);
  }

  function addTypedPath() {
    const path = typedPath.trim();
    if (!path || isDisabled) return;
    selectFile({
      id: path,
      name: fileNameFromPath(path),
      path,
    });
    setTypedPath("");
  }

  async function addBrowserFiles(fileList: FileList | File[]) {
    const incoming = Array.from(fileList);
    let current = files;
    let lastId: string | null = selectedId;

    for (const file of incoming) {
      const nativePath = getNativeFilePath(file);
      const content = nativePath ? undefined : await file.text();
      const item: SourceFileItem = {
        id: nativePath ?? `${file.name}-${file.size}-${file.lastModified}`,
        name: file.name,
        path: nativePath ?? file.name,
        content,
      };
      const exists = current.find((entry) => entry.id === item.id);
      current = exists
        ? current.map((entry) => (entry.id === item.id ? item : entry))
        : [...current, item];
      lastId = item.id;
    }

    onChange(current, lastId);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (isDisabled || event.dataTransfer.files.length === 0) return;
    void addBrowserFiles(event.dataTransfer.files);
  }

  return (
    <div
      className="flex flex-col gap-3"
      onDragEnter={(event) => {
        event.preventDefault();
        if (!isDisabled) setIsDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!isDisabled) setIsDragging(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
        setIsDragging(false);
      }}
      onDrop={handleDrop}
    >
      <label className="flex flex-col gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        파일 경로
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={typedPath}
            onChange={(event) => setTypedPath(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addTypedPath();
              }
            }}
            disabled={isDisabled}
            placeholder="/Users/you/other-project/src/utils.ts"
            className="h-12 flex-1 rounded-full border border-black/[.08] bg-white px-5 font-mono text-sm outline-none focus:border-zinc-400 dark:border-white/[.12] dark:bg-zinc-950"
          />
          <button
            type="button"
            disabled={isDisabled || !typedPath.trim()}
            onClick={addTypedPath}
            className="h-12 rounded-full bg-white px-4 text-sm font-medium text-zinc-800 ring-1 ring-black/[.08] disabled:opacity-40 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-white/[.12]"
          >
            경로 추가
          </button>
          <button
            type="button"
            disabled={isDisabled}
            onClick={() => inputRef.current?.click()}
            className="h-12 rounded-full bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
          >
            파일 열기
          </button>
        </div>
      </label>

      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        accept=".ts,.tsx,.js,.jsx,.mjs,.cjs,.json,.md,.txt"
        onChange={(event) => {
          if (event.target.files?.length) void addBrowserFiles(event.target.files);
          event.target.value = "";
        }}
      />

      <div
        className={`rounded-2xl border border-dashed px-4 py-6 text-center text-sm ${
          isDragging
            ? "border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-900"
            : "border-black/[.12] text-zinc-500 dark:border-white/[.16]"
        }`}
      >
        파일을 여기로 드래그해서 추가하세요. 이 저장소 상대 경로와 다른
        프로젝트의 절대 경로를 모두 쓸 수 있습니다.
      </div>

      <div>
        <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
          실행할 파일
        </p>
        {files.length === 0 ? (
          <p className="rounded-2xl bg-zinc-100 px-4 py-3 text-sm text-zinc-500 dark:bg-zinc-900">
            아직 추가된 파일이 없습니다. 경로를 넣거나 파일을 열면 여기에
            나타납니다. 여러 개를 넣은 뒤 하나를 골라 실행합니다.
          </p>
        ) : (
          <ul className="space-y-2">
            {files.map((file) => (
              <li
                key={file.id}
                className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-sm ${
                  selectedId === file.id
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-white ring-1 ring-black/[.08] dark:bg-zinc-950 dark:ring-white/[.12]"
                }`}
              >
                <button
                  type="button"
                  disabled={isDisabled}
                  onClick={() => onChange(files, file.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate font-medium">{file.name}</span>
                  <span className="block truncate font-mono text-xs opacity-70">
                    {file.path}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={isDisabled}
                  onClick={() => removeFile(file.id)}
                  className="shrink-0 text-xs opacity-70 hover:opacity-100"
                >
                  제거
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function isFilesystemPath(value: string): boolean {
  return (
    value.startsWith("/") ||
    /^[A-Za-z]:[\\/]/.test(value) ||
    value.startsWith("\\\\")
  );
}

function fileNameFromPath(inputPath: string): string {
  const normalized = inputPath.replace(/\\/g, "/");
  return normalized.split("/").filter(Boolean).at(-1) ?? inputPath;
}

function getNativeFilePath(file: File): string | undefined {
  const withPath = file as File & { path?: string };
  if (typeof withPath.path === "string" && withPath.path.trim().length > 0)
    return withPath.path.trim();
  return undefined;
}
