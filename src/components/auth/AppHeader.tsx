"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth/client";

/**
 * Slim top bar with the signed-in user + Sign out. Hidden on the auth pages and
 * on the full-screen 3D views (room editor / apartment), which manage their own
 * chrome and need the full viewport height.
 */
export function AppHeader() {
  const { data: session, isPending } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const fullScreen = pathname.includes("/room/") || pathname.endsWith("/apartment");
  if (pathname === "/login" || pathname === "/signup" || fullScreen) return null;

  return (
    <header
      className="row"
      style={{
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 20px",
        borderBottom: "1px solid var(--border)",
        background: "var(--panel)",
      }}
    >
      <Link href="/" style={{ fontWeight: 600, fontSize: 14 }}>
        Interior Planner
      </Link>
      <div className="row" style={{ gap: 12, alignItems: "center" }}>
        {session?.user ? (
          <>
            <Link href="/settings" className="muted" style={{ fontSize: 13 }}>
              Settings
            </Link>
            <span className="muted hide-sm" style={{ fontSize: 13 }}>
              {session.user.email}
            </span>
            <button
              onClick={async () => {
                await signOut();
                router.push("/login");
                router.refresh();
              }}
              style={{ padding: "5px 10px" }}
            >
              Sign out
            </button>
          </>
        ) : isPending ? null : (
          <Link href="/login" className="primary" style={{ padding: "5px 12px", borderRadius: 8 }}>
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
