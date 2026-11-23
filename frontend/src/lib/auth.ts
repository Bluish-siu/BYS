"use client";
// The signed-in account in the browser. The session itself is an HttpOnly cookie the pages never see.
import { useEffect } from "react";
import { create } from "zustand";

export type Account = { id: string; name: string; email: string | null; phone: string | null; role: "user" | "admin"; emailVerified: boolean };
type AuthState = {
  loaded: boolean;
  enabled: boolean;        // false without a database: no sign-in at all
  mail: boolean;           // e-mail codes are set up (verification and password reset by email)
  user: Account | null;
};

export const useAuthStore = create<AuthState>(() => ({ loaded: false, enabled: false, mail: false, user: null }));

let loading: Promise<void> | null = null;
export function loadAccount(force = false) {
  if (force) loading = null;
  loading ??= fetch("/api/auth/me", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { enabled: false, user: null }))
    .then((d) => useAuthStore.setState({ loaded: true, enabled: Boolean(d.enabled), mail: Boolean(d.mail), user: d.user ?? null }))
    .catch(() => useAuthStore.setState({ loaded: true }));
  return loading;
}

/** The current account. `enabled` is false when the site runs without a database (no sign-in then). */
export function useAccount() {
  const s = useAuthStore();
  useEffect(() => { loadAccount(); }, []);
  return { ...s, needsVerify: Boolean(s.mail && s.user && !s.user.emailVerified) };
}

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function send<T = object>(path: string, body: unknown): Promise<Result<T>> {
  try {
    const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: d.error ?? "Something went wrong. Please try again." };
    if ("user" in d) useAuthStore.setState({ loaded: true, enabled: true, user: d.user ?? null });
    return { ok: true, ...d };
  } catch {
    return { ok: false, error: "Can't reach PickMySeat. Check your internet connection." };
  }
}

export const signIn = (login: string, password: string) => send("/api/auth/login", { login, password });
export const signUp = (name: string, email: string, phone: string, password: string) => send<{ verify: boolean }>("/api/auth/signup", { name, email, phone, password });
export const confirmEmail = (code: string) => send("/api/auth/verify", { code });
export const resendCode = () => send<{ sentTo: string }>("/api/auth/verify", { resend: true });
export const forgotPassword = (login: string) => send<{ mail: boolean; sentTo: string | null }>("/api/auth/forgot", { login });
export const resetPassword = (login: string, code: string, password: string) => send("/api/auth/reset", { login, code, password });
export async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  useAuthStore.setState({ user: null });
}

export const accountLabel = (a: Account) => a.email ?? (a.phone ? `+91 ${a.phone.slice(0, 5)} ${a.phone.slice(5)}` : "");
