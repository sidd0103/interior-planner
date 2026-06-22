"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/auth/client";

interface Props {
  mode: "login" | "signup";
}

/** Email + password sign-in / sign-up form (better-auth). */
export function AuthForm({ mode }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(undefined);
    const res =
      mode === "signup"
        ? await signUp.email({ email, password, name: name.trim() || email.split("@")[0] })
        : await signIn.email({ email, password });
    setBusy(false);
    if (res.error) {
      setErr(res.error.message || "Something went wrong");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main style={{ maxWidth: 380, margin: "0 auto", padding: "72px 24px" }}>
      <h1 style={{ marginBottom: 4 }}>{mode === "signup" ? "Create account" : "Sign in"}</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        {mode === "signup"
          ? "Start arranging rooms in 3D."
          : "Welcome back to Interior Planner."}
      </p>

      <form className="card col" style={{ gap: 10, marginTop: 20 }} onSubmit={submit}>
        {mode === "signup" && (
          <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
          minLength={8}
        />
        {err && (
          <span className="badge err" style={{ alignSelf: "flex-start" }}>
            {err}
          </span>
        )}
        <button className="primary" type="submit" disabled={busy}>
          {busy ? "…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>

      <p className="muted" style={{ fontSize: 13, marginTop: 16, textAlign: "center" }}>
        {mode === "signup" ? (
          <>
            Already have an account? <Link href="/login">Sign in</Link>
          </>
        ) : (
          <>
            New here? <Link href="/signup">Create an account</Link>
          </>
        )}
      </p>
    </main>
  );
}
