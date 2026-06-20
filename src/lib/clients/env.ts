/** Read a required server-side env var, with a clear error if it's missing. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Set it in .env.local (see .env.example) and restart the dev server.`,
    );
  }
  return value;
}

/** Whether a server env var is configured (without throwing). */
export function hasEnv(name: string): boolean {
  return !!process.env[name];
}
