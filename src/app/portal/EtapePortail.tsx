"use client";
import Link from "next/link";
import { ChevronRight, ArrowLeft } from "lucide-react";
import { ATELIERS } from "@/lib/ateliers";
import { etapesAtelier } from "@/lib/etapes";
import { cn } from "@/lib/utils";

export default function EtapePortail({ atelier, etapeActive }: { atelier: 1 | 2; etapeActive?: number | null }) {
  const info = ATELIERS.find((a) => a.id === atelier)!;
  const etapes = etapesAtelier(atelier);
  const accent = atelier === 1 ? "#c24a08" : "#2f6eb5";

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="rounded-2xl border border-black/[0.04] bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#9ca3af]">
              {info.nom} — {etapes.length} étapes
            </p>
            <p className="mt-1 text-sm text-[#6b7280]">{info.description}. Choisissez votre étape :</p>
          </div>
          <Link href="/portal"
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-black/[0.06] bg-black/[0.02] px-3 py-2 text-xs font-bold text-[#6b7280] hover:text-[#1a1d23] transition-colors">
            <ArrowLeft size={14} /> Ateliers
          </Link>
        </div>
      </div>

      {/* Step cards grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {etapes.map((e) => {
          const actif = etapeActive === e.ordre;
          return (
            <Link
              key={e.code}
              href={`/portal?atelier=${atelier}&etape=${e.ordre}`}
              className={cn(
                "group rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md",
                actif ? `border-[${accent}]/40 ring-1 ring-[${accent}]/20` : "border-black/[0.04] hover:border-black/[0.1]"
              )}
              style={actif ? { borderColor: `${accent}40`, boxShadow: `0 0 0 1px ${accent}20` } : undefined}>
              <div className="flex items-start justify-between gap-2">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-black/[0.03] text-2xl">{e.icone}</span>
                <span
                  className="rounded-full px-2.5 py-1 text-[11px] font-black"
                  style={actif ? { background: `${accent}15`, color: accent } : { background: "rgba(0,0,0,.04)", color: "#9ca3af" }}>
                  ÉTAPE {e.ordre}
                </span>
              </div>
              <p className="mt-3 text-lg font-black tracking-tight text-[#1a1d23]">{e.nom}</p>
              <p className="mt-1 text-sm text-[#6b7280]">{e.description}</p>
              <div className="mt-2 rounded-xl bg-black/[0.02] px-3 py-2 text-xs text-[#6b7280]">📋 {e.consigne}</div>
              <p className="mt-3 flex items-center gap-1 text-sm font-black" style={{ color: accent }}>
                {actif ? "Portail ouvert — scanner le QR" : "Ouvrir le portail"} <ChevronRight size={16} className="transition group-hover:translate-x-0.5" />
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
