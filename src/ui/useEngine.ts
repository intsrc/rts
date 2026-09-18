import { useSyncExternalStore } from "react";
import { engine } from "../game/engine";

export function useEngine() {
  useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  return engine;
}

export function fmt(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return Math.floor(n).toString();
}
