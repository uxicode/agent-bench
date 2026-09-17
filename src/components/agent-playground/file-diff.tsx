import {
  DIFF_LINE_KIND,
  countDiffChanges,
  diffLines,
} from "@/lib/agent/line-diff";
import type { AgentFileDiff } from "@/types/agent";

interface FileDiffListProps {
  files: AgentFileDiff[];
}

export function FileDiffList({ files }: FileDiffListProps) {
  const changed = files.filter((file) => file.before !== file.after);

  if (changed.length === 0)
    return <p className="mt-2 text-sm text-zinc-500">변경된 파일이 없습니다.</p>;

  return (
    <div className="mt-2 space-y-4">
      {changed.map((file) => (
        <FileDiff key={file.path} file={file} />
      ))}
    </div>
  );
}

function FileDiff({ file }: { file: AgentFileDiff }) {
  const lines = diffLines(file.before, file.after);
  const { added, removed } = countDiffChanges(lines);

  return (
    <article>
      <div className="mb-1 flex flex-wrap items-baseline gap-2">
        <p className="text-xs font-medium text-zinc-500">
          {file.displayPath ?? file.path}
        </p>
        <p className="font-mono text-xs">
          <span className="text-emerald-700 dark:text-emerald-400">+{added}</span>
          {" "}
          <span className="text-red-700 dark:text-red-400">-{removed}</span>
        </p>
      </div>
      <pre className="overflow-x-auto rounded-xl bg-zinc-50 text-xs leading-5 dark:bg-zinc-900">
        {lines.map((line, index) => (
          <span
            key={`${line.kind}-${index}-${line.beforeNumber ?? ""}-${line.afterNumber ?? ""}`}
            className={`block px-3 ${lineClass(line.kind)}`}
          >
            <span className="inline-block w-4 select-none">
              {prefix(line.kind)}
            </span>
            {line.text || " "}
          </span>
        ))}
      </pre>
    </article>
  );
}

function prefix(kind: (typeof DIFF_LINE_KIND)[keyof typeof DIFF_LINE_KIND]): string {
  if (kind === DIFF_LINE_KIND.add) return "+";
  if (kind === DIFF_LINE_KIND.remove) return "-";
  return " ";
}

function lineClass(kind: (typeof DIFF_LINE_KIND)[keyof typeof DIFF_LINE_KIND]): string {
  if (kind === DIFF_LINE_KIND.add)
    return "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200";
  if (kind === DIFF_LINE_KIND.remove)
    return "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200";
  return "text-zinc-600 dark:text-zinc-400";
}
