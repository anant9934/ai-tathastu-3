// Edge-safe (used by the proxy and the server): ADMIN_EMAILS, comma-separated,
// defaulting to the founder's address.
export const adminEmails = () =>
  (process.env.ADMIN_EMAILS ?? "720anant@gmail.com")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

export const isAdminEmail = (email: string | null | undefined) => Boolean(email && adminEmails().includes(email.toLowerCase()));
