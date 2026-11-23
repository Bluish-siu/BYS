"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { signIn, signUp, useAccount } from "@/lib/auth";

export default function LoginPage() {
  return <Suspense fallback={<p className="p-10 text-fg/60">Loading...</p>}><Login /></Suspense>;
}

function Login() {
  const router = useRouter();
  const params = useSearchParams();
  // Only go back to a page on this site after signing in.
  const next = (() => { const n = params.get("next") ?? "/"; return n.startsWith("/") && !n.startsWith("//") ? n : "/"; })();
  const { loaded, enabled, user } = useAccount();
  const [mode, setMode] = useState<"in" | "up">(params.get("mode") === "up" ? "up" : "in");
  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (user) router.replace(next); }, [user, next, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = mode === "in" ? await signIn(login, password) : await signUp(name, login, password);
    setBusy(false);
    if (!r.ok) setError(r.error);
  };

  if (loaded && !enabled)
    return <p className="mx-auto max-w-md p-10 text-fg/70">Sign-in isn&apos;t available on this copy of PickMySeat because it has no database connected.</p>;

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-3xl font-black">{mode === "in" ? "Sign in" : "Create your account"}</h1>
      <p className="mt-1 text-sm text-fg/60">
        {mode === "in" ? "Your tickets are saved to your account, on every device." : "Use your email address or mobile number."}
      </p>

      <div className="mt-6 grid grid-cols-2 rounded-full border border-fg/15 bg-card p-1 text-sm font-semibold">
        {(["in", "up"] as const).map((m) => (
          <button key={m} type="button" onClick={() => { setMode(m); setError(""); }}
            className={`rounded-full py-2 transition ${mode === m ? "bg-ink text-white" : "text-fg/60 hover:text-fg"}`}>
            {m === "in" ? "Sign in" : "New here? Sign up"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="card mt-5 space-y-4 p-5">
        {mode === "up" && (
          <Field label="Your name">
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required minLength={2} maxLength={60} className="input" placeholder="Shraddha Desai" />
          </Field>
        )}
        <Field label="Email or mobile number">
          <input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" required inputMode="email" className="input" placeholder="you@example.com or 98XXXXXXXX" />
        </Field>
        <Field label="Password" hint={mode === "up" ? "At least 8 characters" : undefined}>
          <div className="relative">
            <input value={password} onChange={(e) => setPassword(e.target.value)} type={show ? "text" : "password"} required minLength={mode === "up" ? 8 : 1}
              autoComplete={mode === "in" ? "current-password" : "new-password"} className="input pr-16" />
            <button type="button" onClick={() => setShow(!show)} className="absolute inset-y-0 right-3 text-xs font-semibold text-fg/60">{show ? "Hide" : "Show"}</button>
          </div>
        </Field>
        {error && <p className="rounded-lg border border-brand/40 bg-brand/10 p-3 text-sm">{error}</p>}
        <button disabled={busy} className="btn btn-brand w-full disabled:opacity-60">{busy ? "Please wait..." : mode === "in" ? "Sign in" : "Create account"}</button>
      </form>
      <p className="mt-4 text-center text-xs text-fg/50">
        By continuing you agree this is a college demo: payments run in test mode. <Link href="/" className="underline">Back to movies</Link>
      </p>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 flex justify-between font-semibold"><span>{label}</span>{hint && <span className="font-normal text-fg/50">{hint}</span>}</span>
      {children}
    </label>
  );
}
