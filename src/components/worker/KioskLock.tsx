"use client";
import { useState } from "react";
import { useMes } from "@/lib/store/mes-store";
import { ATELIERS } from "@/lib/ateliers";
import { etapesAtelier } from "@/lib/etapes";
import { Lock, Unlock } from "lucide-react";

// ── Kiosque : verrouillé sur ATELIER + ÉTAPE ──
// /portal?atelier=1&etape=2 → propose direct Étape 2 Découpe.
export default function KioskLock({ atelierId: forceAtelier, etape: forceEtape }: { atelierId?: 1 | 2 | null; etape?: number | null }) {
  const { kiosk, lock, unlock } = useMes();
  const [atelierId, setAtelierId] = useState<1 | 2>(forceAtelier ?? 1);
  const etapes = etapesAtelier(atelierId);
  const [stepOrder, setStepOrder] = useState(forceEtape ?? 1);
  const [name, setName] = useState("");

  if (kiosk) {
    const def = etapesAtelier(kiosk.atelierId).find((e) => e.ordre === kiosk.stepOrder);
    return (
      <div className="flex items-center justify-between rounded-2xl bg-emerald-900 border border-emerald-600 px-4 py-3 text-white">
        <div>
          <div className="font-bold">🔒 {kiosk.workerName} — Atelier {kiosk.atelierId}{def ? ` · Étape ${def.ordre} ${def.icone} ${def.nom}` : ` · Étape ${kiosk.stepOrder}`}</div>
          <div className="text-xs text-emerald-300">Poste verrouillé. Scannez un QR pour démarrer.</div>
        </div>
        <button onClick={unlock} className="rounded-xl bg-red-600 px-4 py-2 font-bold flex items-center gap-2"><Unlock size={18} /> Déverrouiller</button>
      </div>
    );
  }
  return (
    <div className="rounded-2xl bg-zinc-900 border border-zinc-700 p-4 text-white space-y-3">
      <div className="font-black text-xl flex items-center gap-2"><Lock size={20} /> Verrouiller le poste (mode kiosque)</div>
      {forceEtape ? (
        <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-sm font-bold text-emerald-200">
          📍 Portail Étape {forceEtape} — le poste sera verrouillé sur cette étape.
        </p>
      ) : null}
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de l'opérateur"
        className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-3 text-lg" />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ATELIERS.map((a) => (
          <button key={a.id} type="button" onClick={() => { setAtelierId(a.id); const first = etapesAtelier(a.id)[0]?.ordre ?? 1; setStepOrder(forceAtelier === a.id && forceEtape ? forceEtape : first); }}
            className={`rounded-xl px-4 py-3 text-left text-lg font-bold border ${atelierId === a.id ? "bg-yellow-400 text-black border-yellow-400" : "bg-zinc-800 border-zinc-700"}`}>
            <span className="block">{a.nom}</span>
            <span className={`block text-xs font-normal ${atelierId === a.id ? "text-black/70" : "text-zinc-400"}`}>{a.description}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-bold text-zinc-300">Étape du poste</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {etapes.map((e) => (
            <button key={e.code} type="button" onClick={() => setStepOrder(e.ordre)}
              className={`rounded-xl border px-3 py-2.5 text-left ${stepOrder === e.ordre ? "border-yellow-400 bg-yellow-400/10" : "border-zinc-700 bg-zinc-800"}`}>
              <span className="block text-lg">{e.icone}</span>
              <span className="block text-sm font-bold">{e.ordre}. {e.nom}</span>
            </button>
          ))}
        </div>
        <button
          disabled={!name.trim()}
          onClick={() => lock({ atelierId, stepOrder, workerId: crypto.randomUUID(), workerName: name.trim() })}
          className="rounded-xl bg-emerald-500 py-3 text-lg font-black text-black disabled:opacity-40">
          VERROUILLER LE POSTE — ÉTAPE {stepOrder}
        </button>
      </div>
    </div>
  );
}
