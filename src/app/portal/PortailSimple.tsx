"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Hammer, Package } from "lucide-react";
import { useMes } from "@/lib/store/mes-store";
import { ATELIERS, type AtelierId } from "@/lib/ateliers";
import { etapesAtelier } from "@/lib/etapes";

// Portail atelier simplifié : pas de mot de passe, pas d'identifiant.
// L'ouvrier touche son nom (mémorisé), choisit son atelier + son étape, et scanne.
export default function PortailSimple({ atelierDemande, etapeDemande }: {
  atelierDemande: AtelierId | null; etapeDemande: number | null;
}) {
  const router = useRouter();
  const { kiosk, lock, unlock } = useMes();
  const [nom, setNom] = useState("");
  const [atelierId, setAtelierId] = useState<AtelierId>(atelierDemande ?? 1);
  const [etape, setEtape] = useState<number | null>(etapeDemande);
  const etapes = etapesAtelier(atelierId);
  const accent = atelierId === 1 ? "#c24a08" : atelierId === 2 ? "#2f6eb5" : "#7c3aed";

  useEffect(() => {
    try { setNom(localStorage.getItem("portail-nom") ?? ""); } catch { /* stockage optionnel */ }
  }, []);
  useEffect(() => { if (atelierDemande) setAtelierId(atelierDemande); }, [atelierDemande]);
  useEffect(() => { if (etapeDemande) setEtape(etapeDemande); }, [etapeDemande]);

  // Poste déjà choisi → bandeau compact + bouton changer
  if (kiosk) {
    const def = etapesAtelier(kiosk.atelierId).find((e) => e.ordre === kiosk.stepOrder);
    return (
      <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-[#4a7c59]/20 bg-[#4a7c59]/[0.04] p-4">
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-[#1a1d23]">
            👋 {kiosk.workerName} — Atelier {kiosk.atelierId}{def ? ` · Étape ${def.ordre} ${def.icone} ${def.nom}` : ""}
          </p>
          <p className="mt-0.5 text-xs text-[#6b7280]">Scannez le QR de votre poste pour voir votre objectif.</p>
        </div>
        <button onClick={unlock}
          className="shrink-0 rounded-xl border border-black/[0.06] bg-white px-3 py-2 text-xs font-bold text-[#6b7280] hover:text-[#1a1d23] transition-colors">
          Changer
        </button>
      </div>
    );
  }

  const choisir = () => {
    const n = nom.trim() || "Ouvrier";
    try { localStorage.setItem("portail-nom", n); } catch { /* stockage optionnel */ }
    lock({ atelierId, stepOrder: etape ?? etapes[0]?.ordre ?? 1, workerId: `local-${Date.now()}`, workerName: n });
    const q = new URLSearchParams();
    q.set("atelier", String(atelierId));
    q.set("etape", String(etape ?? etapes[0]?.ordre ?? 1));
    router.replace(`/portal?${q.toString()}`);
  };

  return (
    <div className="mb-4 rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#9ca3af]">Mon poste — sans mot de passe</p>

      {/* Nom (mémorisé) */}
      <label className="mt-3 block text-[12px] font-semibold text-[#6b7280]">Votre prénom</label>
      <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. Yacine"
        className="mt-1 w-full rounded-xl border border-black/[0.08] bg-white px-4 py-3 text-[15px] text-[#1a1d23] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#4a7c59]/20" />

      {/* Atelier */}
      <label className="mt-4 block text-[12px] font-semibold text-[#6b7280]">Votre atelier</label>
      <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {ATELIERS.map((a) => (
          <button key={a.id} type="button"
            onClick={() => { setAtelierId(a.id); setEtape(null); }}
            className="rounded-xl border p-3 text-left transition-all"
            style={atelierId === a.id
              ? { borderColor: accent, background: `${accent}08`, boxShadow: `0 0 0 1px ${accent}20` }
              : { borderColor: "rgba(0,0,0,.06)", background: "white" }}>
            <span className="block text-sm font-bold" style={{ color: atelierId === a.id ? accent : "#1a1d23" }}>
              {a.id === 1 ? <Hammer size={14} className="mr-1 inline" /> : a.id === 2 ? "🔧 " : <Package size={14} className="mr-1 inline" />}{a.nom}
            </span>
            <span className="mt-0.5 block text-xs" style={{ color: atelierId === a.id ? accent : "#9ca3af" }}>
              {a.id === 1 ? "Coupe → Ponçage → Stock" : a.description}
            </span>
          </button>
        ))}
      </div>

      {/* Étape */}
      <label className="mt-4 block text-[12px] font-semibold text-[#6b7280]">Votre étape</label>
      <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {etapes.map((e) => (
          <button key={e.code} type="button" onClick={() => setEtape(e.ordre)}
            className="rounded-xl border p-3 text-left transition-all"
            style={etape === e.ordre
              ? { borderColor: accent, background: `${accent}08`, boxShadow: `0 0 0 1px ${accent}20` }
              : { borderColor: "rgba(0,0,0,.06)", background: "rgba(0,0,0,.02)" }}>
            <span className="block text-lg">{e.icone}</span>
            <span className="mt-1 block text-xs font-bold" style={{ color: etape === e.ordre ? accent : "#6b7280" }}>
              {e.ordre}. {e.nom}
            </span>
          </button>
        ))}
      </div>

      <button onClick={choisir}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[15px] font-black text-white transition-all"
        style={{ background: accent }}>
        Commencer <ChevronRight size={18} />
      </button>
    </div>
  );
}
