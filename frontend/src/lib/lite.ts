"use client";
// Lite mode: for slow phones and data saver. No 3D on the home page, and seats open on the 2D map
// (the 3D hall stays one tap away). It turns on by itself on low-end devices; anyone can switch it.
import { useEffect } from "react";
import { create } from "zustand";

const KEY = "pickmyseat-lite";
type Choice = "on" | "off" | "auto";
type LiteState = { ready: boolean; choice: Choice; auto: boolean; lite: boolean };

export const useLiteStore = create<LiteState>(() => ({ ready: false, choice: "auto", auto: false, lite: false }));

/** True on phones with little memory, few cores, data saver on, or "reduce motion" set. */
function lowEndDevice() {
  const n = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return Boolean(
    (n.deviceMemory && n.deviceMemory <= 2) ||
    (n.hardwareConcurrency && n.hardwareConcurrency <= 2) ||
    n.connection?.saveData ||
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );
}

function init() {
  if (useLiteStore.getState().ready) return;
  let choice: Choice = "auto";
  try { const v = localStorage.getItem(KEY); if (v === "on" || v === "off") choice = v; } catch { /* no storage */ }
  const auto = lowEndDevice();
  useLiteStore.setState({ ready: true, choice, auto, lite: choice === "on" || (choice === "auto" && auto) });
}

export function setLite(on: boolean) {
  const choice: Choice = on ? "on" : "off";
  try { localStorage.setItem(KEY, choice); } catch { /* ignore */ }
  useLiteStore.setState({ choice, lite: on });
}

/** `ready` is false during the first render (server and hydration), so pages don't flash between modes. */
export function useLite() {
  const s = useLiteStore();
  useEffect(init, []);
  return s;
}
