// Client-safe formatting helpers.

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "3 days ago", "yesterday", "just now". `now` is passed in so server output is deterministic per request. */
export function timeAgo(iso: string | Date, now: Date): string {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

export const percent = (value: number) => `${Math.round(value * 100)}%`;
