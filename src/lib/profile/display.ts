// Client-safe: turns a profile_facts jsonb value into the string shown (and
// edited) in the review UI. The server uses the same function to decide
// whether a confirmed value was edited.
export function factDisplayValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value) && value.every((v) => typeof v === "string")) return value.join(", ");
  return JSON.stringify(value);
}
