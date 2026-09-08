export interface AgentCodeSample {
  title: string;
  code: string;
}

export const AGENT_CODE_SAMPLES: AgentCodeSample[] = [
  {
    title: "중복 제거",
    code: `export function uniqueValues<T>(items: T[]): T[] {
  const seen = new Set<T>();
  const result: T[] = [];
  for (const item of items) {
    if (seen.has(item)) continue;
    seen.add(item);
    result.push(item);
  }
  return result;
}
`,
  },
  {
    title: "쿼리 파서",
    code: `export function parseQuery(search: string): Record<string, string> {
  const text = search.startsWith("?") ? search.slice(1) : search;
  if (!text) return {};
  const result: Record<string, string> = {};
  for (const part of text.split("&")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = decodeURIComponent(part.slice(0, eq));
    const value = decodeURIComponent(part.slice(eq + 1));
    result[key] = value;
  }
  return result;
}
`,
  },
  {
    title: "배열 청크",
    code: `export function chunk<T>(items: T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) return [];
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size)
    result.push(items.slice(index, index + size));
  return result;
}
`,
  },
  {
    title: "클래스 카운터",
    code: `export class Counter {
  constructor(private value = 0) {}

  increment(step = 1) {
    this.value += step;
    return this.value;
  }

  reset() {
    this.value = 0;
    return this.value;
  }

  get current() {
    return this.value;
  }
}
`,
  },
];
