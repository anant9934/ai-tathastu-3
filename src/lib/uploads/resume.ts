// Client-safe upload rules, shared by the dropzone and the API routes.

export const RESUME_MAX_BYTES = 10 * 1024 * 1024;

export const RESUME_TYPES = {
  "application/pdf": { ext: "pdf", label: "PDF" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { ext: "docx", label: "DOCX" },
  "image/jpeg": { ext: "jpg", label: "JPG" },
  "image/png": { ext: "png", label: "PNG" },
  "image/webp": { ext: "webp", label: "WebP" },
  "text/plain": { ext: "txt", label: "TXT" },
} as const;

export type ResumeMime = keyof typeof RESUME_TYPES;

const EXT_TO_MIME: Record<string, ResumeMime> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  txt: "text/plain",
};

export const RESUME_ACCEPT = [...Object.keys(RESUME_TYPES), ".pdf", ".docx", ".jpg", ".jpeg", ".png", ".webp", ".txt"].join(",");

export function isResumeMime(mime: string): mime is ResumeMime {
  return mime in RESUME_TYPES;
}

/**
 * Browsers leave File.type empty for some formats (DOCX on several OSes), so
 * fall back to the extension. The worker checks magic bytes either way.
 */
export function resolveResumeMime(file: { name: string; type: string }): ResumeMime | null {
  if (isResumeMime(file.type)) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_MIME[ext] ?? null;
}

export function resumeStorageKey(userId: string, sha256: string, mime: ResumeMime) {
  return `resumes/${userId}/${sha256}.${RESUME_TYPES[mime].ext}`;
}

export const RESUME_PIPELINE_VERSION = 1;

export function resumeJobKey(userId: string, sha256: string) {
  return `resume_extract:${userId}:${sha256}:v${RESUME_PIPELINE_VERSION}`;
}

export function hexToBase64(hex: string) {
  const bytes = hex.match(/../g)!.map((b) => parseInt(b, 16));
  return btoa(String.fromCharCode(...bytes));
}
