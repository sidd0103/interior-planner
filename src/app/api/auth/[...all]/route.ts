import { getAuth } from "@/lib/auth/auth";

// Catch-all better-auth endpoint (sign-up/in/out, session). Call the handler
// lazily so the module doesn't need env/DB at build time.
export function GET(req: Request) {
  return getAuth().handler(req);
}

export function POST(req: Request) {
  return getAuth().handler(req);
}
