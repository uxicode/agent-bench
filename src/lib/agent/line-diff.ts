export const DIFF_LINE_KIND = {
  equal: "equal",
  add: "add",
  remove: "remove",
} as const;

export type DiffLineKind =
  (typeof DIFF_LINE_KIND)[keyof typeof DIFF_LINE_KIND];

export interface DiffLine {
  kind: DiffLineKind;
  text: string;
  beforeNumber?: number;
  afterNumber?: number;
}

export function splitLines(text: string): string[] {
  if (text.length === 0) return [];
  return text.split("\n");
}

export function diffLines(before: string, after: string): DiffLine[] {
  const previous = splitLines(before);
  const next = splitLines(after);
  const table = buildLcsTable(previous, next);
  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  let beforeNumber = 1;
  let afterNumber = 1;

  while (i < previous.length && j < next.length) {
    if (previous[i] === next[j]) {
      lines.push({
        kind: DIFF_LINE_KIND.equal,
        text: previous[i],
        beforeNumber,
        afterNumber,
      });
      i += 1;
      j += 1;
      beforeNumber += 1;
      afterNumber += 1;
      continue;
    }

    if (table[i + 1][j] >= table[i][j + 1]) {
      lines.push({
        kind: DIFF_LINE_KIND.remove,
        text: previous[i],
        beforeNumber,
      });
      i += 1;
      beforeNumber += 1;
      continue;
    }

    lines.push({
      kind: DIFF_LINE_KIND.add,
      text: next[j],
      afterNumber,
    });
    j += 1;
    afterNumber += 1;
  }

  while (i < previous.length) {
    lines.push({
      kind: DIFF_LINE_KIND.remove,
      text: previous[i],
      beforeNumber,
    });
    i += 1;
    beforeNumber += 1;
  }

  while (j < next.length) {
    lines.push({
      kind: DIFF_LINE_KIND.add,
      text: next[j],
      afterNumber,
    });
    j += 1;
    afterNumber += 1;
  }

  return lines;
}

export function countDiffChanges(lines: DiffLine[]): {
  added: number;
  removed: number;
} {
  return {
    added: lines.filter((line) => line.kind === DIFF_LINE_KIND.add).length,
    removed: lines.filter((line) => line.kind === DIFF_LINE_KIND.remove).length,
  };
}

function buildLcsTable(previous: string[], next: string[]): number[][] {
  const rows = previous.length;
  const cols = next.length;
  const table = Array.from({ length: rows + 1 }, () =>
    Array.from({ length: cols + 1 }, () => 0),
  );

  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = cols - 1; j >= 0; j -= 1) {
      table[i][j] =
        previous[i] === next[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  return table;
}
