"use client";
import { create } from "zustand";

export type Kiosk = { atelierId: 1 | 2; stepOrder: number; workerId: string; workerName: string } | null;
export type Cue = { kind: "success" | "error" | "scrap"; message: string; id: number } | null;

type State = {
  kiosk: Kiosk;
  cue: Cue;
  online: boolean;
  queueCount: number;
  lock: (k: NonNullable<Kiosk>) => void;
  unlock: () => void;
  flash: (c: NonNullable<Cue>) => void;
  clearCue: () => void;
  setOnline: (v: boolean) => void;
  setQueueCount: (n: number) => void;
};

export const useMes = create<State>((set) => ({
  kiosk: null,
  cue: null,
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  queueCount: 0,
  lock: (kiosk) => set({ kiosk }),
  unlock: () => set({ kiosk: null }),
  flash: (cue) => set({ cue }),
  clearCue: () => set({ cue: null }),
  setOnline: (online) => set({ online }),
  setQueueCount: (queueCount) => set({ queueCount })
}));
