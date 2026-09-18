import { useSyncExternalStore } from "react";
import type { Quality } from "./Post";

export type { Quality };

let current: Quality = "high";
const subs = new Set<() => void>();

export function getQuality() {
  return current;
}

export function setQuality(q: Quality) {
  if (q === current) return;
  current = q;
  try {
    localStorage.setItem("exo.gfx", q);
  } catch {
    /* ignore */
  }
  subs.forEach((f) => f());
}

export function initQuality(fallback: Quality) {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem("exo.gfx");
  } catch {
    /* ignore */
  }
  current = stored === "low" || stored === "medium" || stored === "high" ? (stored as Quality) : fallback;
  return current;
}

export function subscribeQuality(fn: () => void) {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

export function useQuality() {
  return useSyncExternalStore(subscribeQuality, getQuality, getQuality);
}
