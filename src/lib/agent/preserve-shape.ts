const EXPORT_PATTERNS = [
  /export\s+(?:async\s+)?function\s+([A-Za-z_][\w]*)/g,
  /export\s+class\s+([A-Za-z_][\w]*)/g,
  /export\s+const\s+([A-Za-z_][\w]*)/g,
  /export\s+(?:type|interface|enum)\s+([A-Za-z_][\w]*)/g,
];

export function collectExportedNames(code: string): string[] {
  const names = new Set<string>();

  for (const pattern of EXPORT_PATTERNS) {
    pattern.lastIndex = 0;
    let match = pattern.exec(code);
    while (match) {
      names.add(match[1]);
      match = pattern.exec(code);
    }
  }

  const grouped = code.matchAll(/export\s+\{([^}]+)\}/g);
  for (const block of grouped) {
    for (const part of block[1].split(",")) {
      const name = part
        .trim()
        .split(/\s+as\s+/)
        .at(-1)
        ?.trim();
      if (name) names.add(name);
    }
  }

  return [...names];
}

export function isDestructiveRewrite(before: string, after: string): boolean {
  const original = before.trim();
  const next = after.trim();
  if (!original) return false;
  if (!next) return true;

  if (
    original.length >= 400 &&
    next.length < Math.floor(original.length * 0.6)
  )
    return true;

  const nextNames = new Set(collectExportedNames(next));
  return collectExportedNames(original).some((name) => !nextNames.has(name));
}
