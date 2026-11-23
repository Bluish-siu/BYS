"use client";
// The signed-in account in the browser. The session itself is an HttpOnly cookie the pages never see.
import { useEffect } from "react";
import { create } from "zustand";

export type Account = { id: string; name: string; email: string | null; phone: string | null; role: "user" | "admin" };
type AuthState = { loaded: boolean; enabled: boolean; user: Account | null };

export const useAuthStore = create<AuthState>(() => ({ loaded: false, enabled: false, user: null }));

let loading: Promise<void> | null = null;
export function loadAccount(force = false) {
  if (force) loading = null;
  loading ??= fetch("/api/auth/me", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { enabled: false, user: null }))
    .then((d) => useAuthStore.setState({ loaded: true, enabled: Boolean(d.enabled), user: d.user ?? null }))
    .catch(() => useAuthStore.setState({ loaded: true }));
  return loading;
}

/** The current account. `enabled` is false when the site runs without a database (no sign-in then). */
export function useAccount() {
  const s = useAuthStore();
  useEffect(() => { loadAccount(); }, []);
  return s;
}

async function send(path: string, body: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: d.error ?? "Something went wrong. Please try again." };
    useAuthStore.setState({ loaded: true, enabled: true, user: d.user ?? null });
    return { ok: true };
  } catch {
    return { ok: false, error: "Can't reach PickMySeat. Check your internet connection." };
  }
}

export const signIn = (login: string, password: string) => send("/api/auth/login", { login, password });
export const signUp = (name: string, login: string, password: string) => send("/api/auth/signup", { name, login, password });
export async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  useAuthStore.setState({ user: null });
}

export const accountLabel = (a: Account) => a.email ?? (a.phone ? `+91 ${a.phone.slice(0, 5)} ${a.phone.slice(5)}` : "");
