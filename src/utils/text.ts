/** Trims and collapses runs of spaces. */
export function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Lower-case, accent-free form used to compare and search ("Këmba" matches "kemba"). */
export function foldText(value: string): string {
  return cleanText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function sameText(a: string, b: string): boolean {
  return foldText(a) === foldText(b);
}

/** The saved spelling of `value` if the list already has it (ignoring case and accents), otherwise the cleaned value. */
export function canonicalValue(value: string, list: readonly string[]): string {
  const clean = cleanText(value);
  return list.find((item) => sameText(item, clean)) ?? clean;
}

/** Cleans every value, removes duplicates (ignoring case and accents) and sorts A to Z. */
export function sortedUnique(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const value = cleanText(raw);
    const key = foldText(value);
    if (value && !seen.has(key)) {
      seen.add(key);
      result.push(value);
    }
  }
  return result.sort((a, b) => {
    const fa = foldText(a);
    const fb = foldText(b);
    return fa < fb ? -1 : fa > fb ? 1 : 0;
  });
}

/** A unique id that is made on the phone, so a retried save writes the same record again instead of a second one. */
export function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
