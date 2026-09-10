"use client";
import Link from "next/link";
import { ChevronRight, ArrowLeft } from "lucide-react";
import { ATELIERS } from "@/lib/ateliers";
import { etapesAtelier } from "@/lib/etapes";
import { cn } from "@/lib/utils";

// ── Portail atelier : 1 carte = 1 étape = 1 portail ──
// /portal?atelier=1&etape=2 → poste verrouillé sur cette étape.
export default function EtapePortail({ atelier, etapeActive }: { atelier: 1 | 2; etapeActive?: number | null }) {
  const info = ATELIERS.find((a) => a.id === atelier)!;
  const etapes = etapesAtelier(atelier);
  const accent = atelier === 1 ? "text-orange-300" : "text-emerald-300";

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">
              {info.nom} — {etapes.length} étapes
            </p>
            <p className="mt-1 text-sm text-zinc-400">{info.description}. Choisissez votre étape : chaque étape a son portail dédié.</p>
          </div>
          <Link href="/portal" className="flex shrink-0 items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-zinc-300 hover:text-white">
            <ArrowLeft size={14} /> Ateliers
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {etapes.map((e) => {
          const actif = etapeActive === e.ordre;
          return (
            <Link
              key={e.code}
              href={`/portal?atelier=${atelier}&etape=${e.ordre}`}
              className={cn(
                "glass group rounded-2xl p-5 transition",
                actif ? "border-emerald-400/50 ring-1 ring-emerald-400/40" : "hover:border-white/25"
              )}>
              <div className="flex items-start justify-between gap-2">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/5 text-2xl">{e.icone}</span>
                <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-black", actif ? "bg-emerald-500/20 text-emerald-200" : "bg-white/5 text-zinc-400")}>
                  ÉTAPE {e.ordre}
                </span>
              </div>
              <p className="mt-3 text-lg font-black tracking-tight text-white">{e.nom}</p>
              <p className="mt-1 text-sm text-zinc-400">{e.description}</p>
              <p className="mt-2 rounded-xl bg-white/5 px-3 py-2 text-xs text-zinc-300">📋 {e.consigne}</p>
              <p className={cn("mt-3 flex items-center gap-1 text-sm font-black", actif ? "text-emerald-300" : accent)}>
                {actif ? "Portail ouvert — scanner le QR" : "Ouvrir le portail"} <ChevronRight size={16} className="transition group-hover:translate-x-0.5" />
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
