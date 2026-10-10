"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { hapticRef } from "@/lib/haptics";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(false);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.replace(params.get("next") || "/");
      router.refresh();
    } else {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <input
        type="password"
        autoFocus
        autoComplete="current-password"
        enterKeyHint="go"
        placeholder="passphrase"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={error ? "err" : ""}
      />
      {error && <div className="loginerr">Wrong passphrase.</div>}
      <button className="save" type="submit" ref={hapticRef} data-haptic="medium" disabled={busy || !password}>
        {busy ? "Checking…" : "Unlock"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="login">
      <div className="kicker">Ironpage</div>
      <h1 className="title">Locked</h1>
      <p className="subtle">Single-user. Enter the passphrase to continue.</p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
