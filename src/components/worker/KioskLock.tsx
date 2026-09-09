"use client";
import { useState } from "react";
import { useMes } from "@/lib/store/mes-store";
import { ATELIERS } from "@/lib/ateliers";
import { Lock, Unlock } from "lucide-react";

export default function KioskLock({ atelierId: forceAtelier }: { atelierId?: 1 | 2 | null }) {
  const { kiosk, lock, unlock } = useMes();
  const [atelierId, setAtelierId] = useState<1 | 2>(forceAtelier ?? 1);
  const [stepOrder, setStepOrder] = useState(1);
  const [name, setName] = useState("");

  if (kiosk) {
    return (
      <div className="flex items-center justify-between rounded-2xl bg-emerald-900 border border-emerald-600 px-4 py-3 text-white">
        <div>
          <div className="font-bold">🔒 {kiosk.workerName} — Atelier {kiosk.atelierId} · Étape {kiosk.stepOrder}</div>
          <div className="text-xs text-emerald-300">Poste verrouillé. Scannez un QR pour démarrer.</div>
        </div>
        <button onClick={unlock} className="rounded-xl bg-red-600 px-4 py-2 font-bold flex items-center gap-2"><Unlock size={18} /> Déverrouiller</button>
      </div>
    );
  }
  return (
    <div className="rounded-2xl bg-zinc-900 border border-zinc-700 p-4 text-white space-y-3">
      <div className="font-black text-xl flex items-center gap-2"><Lock size={20} /> Verrouiller le poste (mode kiosque)</div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de l'opérateur"
        className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-3 text-lg" />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ATELIERS.map((a) => (
          <button key={a.id} type="button" onClick={() => setAtelierId(a.id)}
            className={`rounded-xl px-4 py-3 text-left text-lg font-bold border ${atelierId === a.id ? "bg-yellow-400 text-black border-yellow-400" : "bg-zinc-800 border-zinc-700"}`}>
            <span className="block">{a.nom}</span>
            <span className={`block text-xs font-normal ${atelierId === a.id ? "text-black/70" : "text-zinc-400"}`}>{a.description}</span>
          </button>
        ))}
      </div>
      <div className="flex gap-2 items-center">
        <label className="text-zinc-400">Étape n°</label>
        <input type="number" min={1} max={30} value={stepOrder} onChange={(e) => setStepOrder(Number(e.target.value))}
          className="w-24 rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2 text-lg" />
        <button
          disabled={!name.trim()}
          onClick={() => lock({ atelierId, stepOrder, workerId: crypto.randomUUID(), workerName: name.trim() })}
          className="flex-1 rounded-xl bg-emerald-500 py-3 text-lg font-black text-black disabled:opacity-40">
          VERROUILLER LE POSTE
        </button>
      </div>
    </div>
  );
}
