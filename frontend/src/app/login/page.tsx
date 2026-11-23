"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { confirmEmail, forgotPassword, resendCode, resetPassword, signIn, signUp, useAccount } from "@/lib/auth";

export default function LoginPage() {
  return <Suspense fallback={<p className="p-10 text-fg/60">Loading...</p>}><Login /></Suspense>;
}

type Mode = "in" | "up" | "verify" | "forgot" | "reset";

function Login() {
  const router = useRouter();
  const params = useSearchParams();
  // Only go back to a page on this site after signing in.
  const next = (() => { const n = params.get("next") ?? "/"; return n.startsWith("/") && !n.startsWith("//") ? n : "/"; })();
  const { loaded, enabled, mail, user, needsVerify } = useAccount();
  const [mode, setMode] = useState<Mode>(params.get("mode") === "up" ? "up" : params.get("mode") === "verify" ? "verify" : "in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  // Signed in: go on, unless the email still has to be confirmed.
  useEffect(() => {
    if (!user || mode === "reset") return;
    if (needsVerify) setMode("verify");
    else router.replace(next);
  }, [user, needsVerify, next, router, mode]);

  const go = (m: Mode) => { setMode(m); setError(""); setNote(""); setCode(""); };
  const run = async (fn: () => Promise<{ ok: boolean; error?: string } & object>) => {
    setBusy(true); setError(""); setNote("");
    const r = await fn();
    setBusy(false);
    if (!r.ok) setError((r as { error: string }).error);
    return r;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "in") await run(() => signIn(login, password));
    if (mode === "up") await run(() => signUp(name, email, phone, password));
    if (mode === "verify") {
      const r = await run(() => confirmEmail(code));
      if (r.ok) router.replace(next);
    }
    if (mode === "forgot") {
      const r = await run(() => forgotPassword(login));
      if (r.ok) {
        const d = r as unknown as { mail: boolean; sentTo: string | null };
        if (!d.mail) return setNote("Password reset by email isn't set up on this site. Ask a PickMySeat admin to reset your password from the admin panel.");
        go("reset");
        setNote(d.sentTo ? `We emailed a 6-digit code to ${d.sentTo}.` : "If an account exists, we emailed it a 6-digit code.");
      }
    }
    if (mode === "reset") {
      const r = await run(() => resetPassword(login, code, password));
      if (r.ok) router.replace(next);
    }
  };

  if (loaded && !enabled)
    return <p className="mx-auto max-w-md p-10 text-fg/70">Sign-in isn&apos;t available on this copy of PickMySeat because it has no database connected.</p>;

  const titles: Record<Mode, [string, string]> = {
    in: ["Sign in", "Your tickets are saved to your account, on every device."],
    up: ["Create your account", mail ? "We'll email you a code to confirm it's you." : "Tickets are saved to your account."],
    verify: ["Confirm your email", user?.email ? `Enter the 6-digit code we sent to ${user.email}.` : "Enter the 6-digit code we emailed you."],
    forgot: ["Forgot your password?", "Enter your email or mobile number and we'll email you a code."],
    reset: ["Set a new password", "Enter the code from the email and choose a new password."],
  };

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-3xl font-black">{titles[mode][0]}</h1>
      <p className="mt-1 text-sm text-fg/60">{titles[mode][1]}</p>

      {(mode === "in" || mode === "up") && (
        <div className="mt-6 grid grid-cols-2 rounded-full border border-fg/15 bg-card p-1 text-sm font-semibold">
          {(["in", "up"] as const).map((m) => (
            <button key={m} type="button" onClick={() => go(m)} className={`rounded-full py-2 transition ${mode === m ? "bg-ink text-white" : "text-fg/60 hover:text-fg"}`}>
              {m === "in" ? "Sign in" : "New here? Sign up"}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="card mt-5 space-y-4 p-5">
        {mode === "up" && (
          <>
            <Field label="Your name"><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required minLength={2} maxLength={60} className="input" placeholder="Shraddha Desai" /></Field>
            <Field label="Email"><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required className="input" placeholder="you@example.com" /></Field>
            <Field label="Mobile number" hint="Optional, to sign in with it"><input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" autoComplete="tel" inputMode="numeric" className="input" placeholder="98XXXXXXXX" /></Field>
          </>
        )}
        {(mode === "in" || mode === "forgot" || mode === "reset") && (
          <Field label="Email or mobile number">
            <input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" required inputMode="email" className="input" placeholder="you@example.com or 98XXXXXXXX" readOnly={mode === "reset"} />
          </Field>
        )}
        {(mode === "verify" || mode === "reset") && (
          <Field label="6-digit code">
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" required pattern="\d{6}" className="input text-center text-2xl tracking-[0.5em]" placeholder="••••••" />
          </Field>
        )}
        {(mode === "in" || mode === "up" || mode === "reset") && (
          <Field label={mode === "reset" ? "New password" : "Password"} hint={mode !== "in" ? "At least 8 characters" : undefined}>
            <div className="relative">
              <input value={password} onChange={(e) => setPassword(e.target.value)} type={show ? "text" : "password"} required minLength={mode === "in" ? 1 : 8}
                autoComplete={mode === "in" ? "current-password" : "new-password"} className="input pr-16" />
              <button type="button" onClick={() => setShow(!show)} className="absolute inset-y-0 right-3 text-xs font-semibold text-fg/60">{show ? "Hide" : "Show"}</button>
            </div>
          </Field>
        )}
        {note && <p className="rounded-lg bg-fg/5 p-3 text-sm">{note}</p>}
        {error && <p className="rounded-lg border border-brand/40 bg-brand/10 p-3 text-sm">{error}</p>}
        <button disabled={busy} className="btn btn-brand w-full disabled:opacity-60">
          {busy ? "Please wait..." : { in: "Sign in", up: "Create account", verify: "Confirm email", forgot: "Email me a code", reset: "Save new password" }[mode]}
        </button>

        <div className="flex flex-wrap justify-between gap-2 text-sm">
          {mode === "in" && <button type="button" onClick={() => go("forgot")} className="font-semibold text-brand">Forgot password?</button>}
          {(mode === "forgot" || mode === "reset") && <button type="button" onClick={() => go("in")} className="font-semibold text-fg/60">← Back to sign in</button>}
          {mode === "reset" && <button type="button" onClick={() => run(async () => { const r = await forgotPassword(login); if (r.ok) setNote("A new code is on its way."); return r; })} className="font-semibold text-brand">Send a new code</button>}
          {mode === "verify" && (
            <>
              <button type="button" onClick={() => run(async () => { const r = await resendCode(); if (r.ok) setNote(`New code sent to ${(r as unknown as { sentTo: string }).sentTo}.`); return r; })} className="font-semibold text-brand">Send a new code</button>
              <button type="button" onClick={() => router.replace(next)} className="text-fg/55">Later</button>
            </>
          )}
        </div>
      </form>
      <p className="mt-4 text-center text-xs text-fg/50">
        PickMySeat is a college project: payments run in Razorpay test mode. <Link href="/" className="underline">Back to movies</Link>
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
