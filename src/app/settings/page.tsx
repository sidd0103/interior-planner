"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth/client";
import { migrateLocalToCloud, pendingLocalProjects } from "@/lib/migration/migrateLocalToCloud";

export default function SettingsPage() {
  const { data: session, isPending } = useSession();
  const [pending, setPending] = useState<number | null>(null);
  const [status, setStatus] = useState<string>();
  const [result, setResult] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    pendingLocalProjects().then(setPending);
  }, []);

  async function migrate() {
    setBusy(true);
    setResult(undefined);
    try {
      const r = await migrateLocalToCloud((name, i, total) =>
        setStatus(`Importing “${name}” (${i}/${total})…`),
      );
      setResult(
        `Imported ${r.projects} project${r.projects === 1 ? "" : "s"}` +
          (r.skipped ? `, ${r.skipped} already imported.` : "."),
      );
      setPending(0);
    } catch (e) {
      setResult("Error: " + (e as Error).message);
    } finally {
      setStatus(undefined);
      setBusy(false);
    }
  }

  if (!isPending && !session?.user) {
    return (
      <main style={{ maxWidth: 680, margin: "0 auto", padding: "48px 24px" }}>
        <p className="muted">
          Please <Link href="/login">sign in</Link> to access settings.
        </p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: "32px 24px" }}>
      <Link href="/" className="muted" style={{ fontSize: 13 }}>
        ← Back to projects
      </Link>
      <h1 style={{ margin: "8px 0 0" }}>Settings</h1>

      <section className="card col" style={{ marginTop: 20, gap: 10 }}>
        <strong style={{ fontSize: 15 }}>Import local projects</strong>
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          Projects you made in this browser before signing in are stored locally. Sync them to your
          account to access them anywhere. Already-imported projects are skipped.
        </p>
        {pending === 0 ? (
          <span className="badge">No local projects to import.</span>
        ) : (
          <>
            <span className="muted" style={{ fontSize: 13 }}>
              {pending ?? "…"} local project{pending === 1 ? "" : "s"} found in this browser.
            </span>
            <button
              className="primary"
              onClick={migrate}
              disabled={busy || !pending}
              style={{ alignSelf: "flex-start" }}
            >
              {busy ? status ?? "Importing…" : "Sync local projects to my account"}
            </button>
          </>
        )}
        {result && (
          <span className="badge ok" style={{ alignSelf: "flex-start" }}>
            {result}
          </span>
        )}
      </section>
    </main>
  );
}
