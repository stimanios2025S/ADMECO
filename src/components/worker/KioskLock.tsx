"use client";
import { useState } from "react";
import { useMes } from "@/lib/store/mes-store";
import { ATELIERS, type AtelierId } from "@/lib/ateliers";
import { etapesAtelier } from "@/lib/etapes";
import { Lock, Unlock } from "lucide-react";

export default function KioskLock({ atelierId: forceAtelier, etape: forceEtape }: { atelierId?: AtelierId | null; etape?: number | null }) {
  const { kiosk, lock, unlock } = useMes();
  const [atelierId, setAtelierId] = useState<AtelierId>(forceAtelier ?? 1);
  const etapes = etapesAtelier(atelierId);
  const [stepOrder, setStepOrder] = useState(forceEtape ?? 1);
  const [name, setName] = useState("");
  const accent = atelierId === 1 ? "#c24a08" : atelierId === 2 ? "#2f6eb5" : "#7c3aed";

  // ── Already locked ──
  if (kiosk) {
    const def = etapesAtelier(kiosk.atelierId).find((e) => e.ordre === kiosk.stepOrder);
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#4a7c59]/20 bg-[#4a7c59]/[0.04] p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-[#4a7c59] shrink-0" />
            <span className="font-bold text-[#1a1d23] truncate">
              {kiosk.workerName} — Atelier {kiosk.atelierId}{def ? ` · Étape ${def.ordre} ${def.icone} ${def.nom}` : ` · Étape ${kiosk.stepOrder}`}
            </span>
          </div>
          <p className="mt-0.5 pl-6 text-xs text-[#6b7280]">Poste verrouillé. Scannez un QR pour démarrer.</p>
        </div>
        <button onClick={unlock}
          className="flex shrink-0 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-100 transition-colors">
          <Unlock size={16} /> Déverrouiller
        </button>
      </div>
    );
  }

  // ── Lock form ──
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-black/[0.04] text-[#6b7280]">
          <Lock size={17} />
        </span>
        <div>
          <p className="text-sm font-bold text-[#1a1d23]">Verrouiller le poste</p>
          <p className="text-xs text-[#9ca3af]">Identifiez-vous et choisissez votre étape</p>
        </div>
      </div>

      {forceEtape && (
        <div className="mb-4 rounded-xl border border-dashed px-3 py-2.5 text-xs font-semibold" style={{ borderColor: `${accent}30`, background: `${accent}08`, color: accent }}>
          📍 Portail Étape {forceEtape} — le poste sera verrouillé sur cette étape.
        </div>
      )}

      {/* Worker name */}
      <div className="space-y-1.5">
        <label className="text-[12px] font-semibold text-[#6b7280]">Votre nom</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de l'opérateur"
          className="w-full rounded-xl border border-black/[0.08] bg-white px-4 py-3 text-[15px] text-[#1a1d23] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#4a7c59]/20 transition-shadow" />
      </div>

      {/* Atelier selector */}
      <div className="mt-4 space-y-2">
        <label className="text-[12px] font-semibold text-[#6b7280]">Votre atelier</label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ATELIERS.map((a) => (
            <button key={a.id} type="button"
              onClick={() => {
                setAtelierId(a.id);
                const first = etapesAtelier(a.id)[0]?.ordre ?? 1;
                setStepOrder(forceAtelier === a.id && forceEtape ? forceEtape : first);
              }}
              className="rounded-xl border p-3.5 text-left transition-all"
              style={atelierId === a.id
                ? { borderColor: accent, background: `${accent}08`, boxShadow: `0 0 0 1px ${accent}20` }
                : { borderColor: "rgba(0,0,0,.06)", background: "white" }}>
              <span className="block text-sm font-bold" style={{ color: atelierId === a.id ? accent : "#1a1d23" }}>
                {a.nom}
              </span>
              <span className="block mt-0.5 text-xs" style={{ color: atelierId === a.id ? accent : "#9ca3af" }}>
                {a.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Step selector */}
      <div className="mt-4 space-y-2">
        <label className="text-[12px] font-semibold text-[#6b7280]">Votre étape</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {etapes.map((e) => (
            <button key={e.code} type="button" onClick={() => setStepOrder(e.ordre)}
              className="rounded-xl border p-3 text-left transition-all"
              style={stepOrder === e.ordre
                ? { borderColor: accent, background: `${accent}08`, boxShadow: `0 0 0 1px ${accent}20` }
                : { borderColor: "rgba(0,0,0,.06)", background: "rgba(0,0,0,.02)" }}>
              <span className="block text-lg">{e.icone}</span>
              <span className="block mt-1 text-xs font-bold" style={{ color: stepOrder === e.ordre ? accent : "#6b7280" }}>
                {e.ordre}. {e.nom}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Lock button */}
      <button
        disabled={!name.trim()}
        onClick={() => lock({ atelierId, stepOrder, workerId: crypto.randomUUID(), workerName: name.trim() })}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[15px] font-black text-white transition-all disabled:opacity-30"
        style={{ background: accent }}>
        <Lock size={18} />
        VERROUILLER — ÉTAPE {stepOrder}
      </button>
    </div>
  );
}
