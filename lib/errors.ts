// Messages we intentionally show to users. Anything else (Prisma/driver
// internals) is replaced with a generic message so engine details never
// reach the client.
const KNOWN_USER_MESSAGES = new Set(["This reporting period is locked."]);

export function safeErrorMessage(e: unknown): string {
  const message = e instanceof Error ? e.message : "";
  if (KNOWN_USER_MESSAGES.has(message)) return message;
  // Log the real error server-side; the client only ever sees the generic text.
  console.error("[action]", e);
  return "Something went wrong. Please try again.";
}
