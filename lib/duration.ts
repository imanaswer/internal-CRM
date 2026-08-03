export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 60_000) return "<1m";
  const units: [string, number][] = [
    ["d", 86400_000],
    ["h", 3600_000],
    ["m", 60_000],
  ];
  const parts: string[] = [];
  let rest = ms;
  for (const [label, size] of units) {
    const n = Math.floor(rest / size);
    if (n > 0) {
      parts.push(`${n}${label}`);
      rest -= n * size;
    }
    if (parts.length === 2) break;
  }
  return parts.join(" ");
}

const IST = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function istStamp(d: Date): string {
  return IST.format(d).replace(" at ", ", ");
}

const STOPWORDS = new Set([
  "the", "and", "for", "not", "with", "its", "has", "have", "was", "are",
  "this", "that", "from", "when", "since", "after", "office", "issue",
  "problem", "error",
]);

export function significantWords(title: string): string[] {
  return [...new Set(
    title.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOPWORDS.has(w))
  )];
}

export function titlesSimilar(a: string, b: string): boolean {
  const src = significantWords(a);
  if (src.length === 0) return false;
  const other = new Set(significantWords(b));
  const overlap = src.filter((w) => other.has(w)).length;
  return overlap >= Math.min(2, src.length);
}
