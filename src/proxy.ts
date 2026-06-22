import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Next 16 Proxy (formerly middleware). OPTIMISTIC gate only — reads the session
 * cookie, no DB. Real authorization lives in the data layer (Server Actions),
 * because Proxy is not a security boundary for Server Action POSTs.
 *
 * Logged-out users are redirected from the dashboard to /login. Everything else
 * (esp. /project/* so public share links work logged-out, plus /login, /signup,
 * /api) is allowed through.
 */
export function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const hasSession = !!getSessionCookie(req);

  if (path === "/" && !hasSession) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  if ((path === "/login" || path === "/signup") && hasSession) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
