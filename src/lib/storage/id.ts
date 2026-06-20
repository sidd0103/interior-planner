/** Generate a unique id. Uses crypto.randomUUID where available. */
export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for older runtimes.
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
