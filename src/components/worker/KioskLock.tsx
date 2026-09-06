"use client";
import { useState } from "react";
import { useMes } from "@/lib/store/mes-store";
import { Lock, Unlock } from "lucide-react";

const ATELIERS = [
  { id: 1, label: "Atelier 1 — Woodworking" },
  { id: 2, label: "Atelier 2 — Assembly & Metal" },
  { id: 3, label: "Atelier 3 — Finishing & QC (Site B)" }
];

export default function KioskLock() {
  const { kiosk, lock, unlock } = useMes();
  const [atelierId, setAtelierId] = useState(1);
  const [stepOrder, setStepOrder] = useState(1);
  const [name, setName] = useState("");

  if (kiosk) {
    return (
      <div className="flex items-center justify-between rounded-2xl bg-emerald-900 border border-emerald-600 px-4 py-3 text-white">
        <div>
          <div className="font-bold">🔒 {kiosk.workerName} — Atelier {kiosk.atelierId} · Step {kiosk.stepOrder}</div>
          <div className="text-xs text-emerald-300">Station locked. Scan QR to start.</div>
        </div>
        <button onClick={unlock} className="rounded-xl bg-red-600 px-4 py-2 font-bold flex items-center gap-2"><Unlock size={18} /> Unlock</button>
      </div>
    );
  }
  return (
    <div className="rounded-2xl bg-zinc-900 border border-zinc-700 p-4 text-white space-y-3">
      <div className="font-black text-xl flex items-center gap-2"><Lock size={20} /> Lock station (Kiosk mode)</div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Worker name"
        className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-3 text-lg" />
      <div className="grid grid-cols-1 gap-2">
        {ATELIERS.map((a) => (
          <button key={a.id} onClick={() => setAtelierId(a.id)}
            className={`rounded-xl px-4 py-3 text-left text-lg font-bold border ${atelierId === a.id ? "bg-yellow-400 text-black border-yellow-400" : "bg-zinc-800 border-zinc-700"}`}>
            {a.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2 items-center">
        <label className="text-zinc-400">Step #</label>
        <input type="number" min={1} max={30} value={stepOrder} onChange={(e) => setStepOrder(Number(e.target.value))}
          className="w-24 rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2 text-lg" />
        <button
          disabled={!name.trim()}
          onClick={() => lock({ atelierId: atelierId as 1 | 2 | 3, stepOrder, workerId: crypto.randomUUID(), workerName: name.trim() })}
          className="flex-1 rounded-xl bg-emerald-500 py-3 text-lg font-black text-black disabled:opacity-40">
          LOCK STATION
        </button>
      </div>
    </div>
  );
}
