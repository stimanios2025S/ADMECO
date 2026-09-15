"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { statutFr } from "@/lib/fr";
import { ETAPES_A1 } from "@/lib/etapes";
import Link from "next/link";
import { Package, Clock, CheckCircle2, Loader2 } from "lucide-react";

type Etape = {
  id: string; step_order: number; step_name: string; status: string;
  estimated_minutes: number; started_at: string | null;
  work_order_items?: { product_name: string; quantity: number } | null;
};

const ACCENT = "#c24a08";
const ACCENT_SOFT = "rgba(194,74,8,.06)";
const ACCENT_BORDER = "rgba(194,74,8,.15)";

export default function Atelier1Tools({ etape }: { etape?: number | null }) {
  const def = ETAPES_A1.find((e) => e.ordre === etape) ?? null;
  const [lignes, setLignes] = useState<Etape[]>([]);
  const [stats, setStats] = useState({ pending: 0, active: 0, done: 0 });
  const [charge, setCharge] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();

      let q = supabase.from("work_order_steps")
        .select("id,step_order,step_name,status,estimated_minutes,started_at,work_order_items(product_name,quantity)")
        .eq("atelier_id", 1);
      if (etape) q = q.eq("step_order", etape);
      q = q.order("step_order").limit(20);
      const { data } = await q;
      if (data) setLignes(data as any);

      let sq = supabase.from("work_order_steps").select("status", { count: "exact" }).eq("atelier_id", 1);
      if (etape) sq = sq.eq("step_order", etape);
      const { count: total } = await sq;
      let sq2 = supabase.from("work_order_steps").select("status", { count: "exact" }).eq("atelier_id", 1).eq("status", "DONE");
      if (etape) sq2 = sq2.eq("step_order", etape);
      const { count: done } = await sq2;
      let sq3 = supabase.from("work_order_steps").select("status", { count: "exact" }).eq("atelier_id", 1).eq("status", "ACTIVE");
      if (etape) sq3 = sq3.eq("step_order", etape);
      const { count: active } = await sq3;
      setStats({ pending: (total ?? 0) - (done ?? 0) - (active ?? 0), active: active ?? 0, done: done ?? 0 });
      setCharge(false);
    })();
  }, [etape]);

  const total = stats.done + stats.active + stats.pending;
  const pct = total > 0 ? Math.round((stats.done / total) * 100) : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* ── Info card ── */}
      <div className="rounded-2xl border border-black/[0.04] bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: ACCENT_SOFT, color: ACCENT }}>
            {def ? `Étape ${def.ordre}/${ETAPES_A1.length}` : "Atelier 1 — Poste"}
          </span>
          {def && <span className="rounded-full bg-black/[0.04] px-2.5 py-1 text-[11px] font-bold text-[#9ca3af]">{def.code}</span>}
        </div>

        <h2 className="mt-3 text-2xl font-black tracking-tight text-[#1a1d23]">
          {def ? `${def.icone} ${def.nom}` : "🪚 Bois & Découpe"}
        </h2>
        <p className="mt-1 text-sm text-[#6b7280]">
          {def ? def.description : "Découpe, usinage, préparation."}
        </p>

        {def && (
          <div className="mt-3 rounded-xl px-3 py-2.5 text-xs font-semibold" style={{ background: ACCENT_SOFT, color: ACCENT }}>
            📋 {def.consigne}
          </div>
        )}

        <div className="mt-3 rounded-xl bg-black/[0.02] px-3 py-2 text-xs text-[#6b7280]">
          📦 <span className="font-bold text-[#1a1d23]">DEP-MP centrale</span> → alimente ce poste · Production → <span className="font-bold text-[#1a1d23]">Stock A1</span>
        </div>

        {/* Progress bar */}
        {!charge && total > 0 && (
          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-[#9ca3af]">
              <span>{stats.done} terminée{stats.done > 1 ? "s" : ""} sur {total}</span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-black/[0.04]">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: ACCENT }} />
            </div>
            <div className="flex gap-4 text-[11px] font-bold text-[#9ca3af]">
              <span className="flex items-center gap-1"><Clock size={11} /> {stats.active} en cours</span>
              <span className="flex items-center gap-1"><Package size={11} /> {stats.pending} en attente</span>
            </div>
          </div>
        )}

        {/* Quick nav */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {ETAPES_A1.map((e) => (
            <Link key={e.code} href={`/portal?atelier=1&etape=${e.ordre}`}
              className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors"
              style={e.ordre === etape
                ? { background: ACCENT_SOFT, color: ACCENT, boxShadow: `inset 0 0 0 1px ${ACCENT_BORDER}` }
                : { background: "rgba(0,0,0,.03)", color: "#9ca3af" }}>
              {e.icone} {e.ordre}
            </Link>
          ))}
        </div>

        <Link href="/portal?atelier=1"
          className="mt-3 inline-flex items-center gap-1 rounded-xl border border-black/[0.06] bg-black/[0.02] px-3 py-2 text-xs font-bold text-[#6b7280] hover:text-[#1a1d23] transition-colors">
          ← Toutes les étapes A1
        </Link>
      </div>

      {/* ── Queue ── */}
      <div className="rounded-2xl border border-black/[0.04] bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#9ca3af]">
            {def ? `File — Étape ${def.ordre}` : "File Atelier 1"} · {lignes.length}
          </p>
        </div>

        {charge ? (
          <div className="mt-4 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl bg-black/[0.02] p-3 animate-pulse">
                <div className="h-5 w-5 rounded bg-black/[0.06]" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-3/4 rounded bg-black/[0.06]" />
                  <div className="h-2.5 w-1/2 rounded bg-black/[0.04]" />
                </div>
              </div>
            ))}
          </div>
        ) : lignes.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-black/[0.08] bg-black/[0.01] p-8 text-center">
            <p className="text-3xl">{def ? "✅" : "📭"}</p>
            <p className="mt-2 text-sm font-bold text-[#6b7280]">
              {def ? `Aucune pièce pour ${def.nom}` : "Aucune étape en attente"}
            </p>
            <p className="mt-1 text-xs text-[#9ca3af]">Toutes les pièces ont été traitées.</p>
          </div>
        ) : (
          <div className="mt-3 space-y-1.5">
            {lignes.map((e) => (
              <div key={e.id}
                className="flex items-center gap-3 rounded-xl p-3 text-sm transition-colors"
                style={e.status === "ACTIVE"
                  ? { border: `1px solid ${ACCENT_BORDER}`, background: ACCENT_SOFT }
                  : { background: "rgba(0,0,0,.02)" }}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black text-white" style={{ background: ACCENT }}>
                  {e.step_order}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-[#1a1d23]">{e.step_name}</span>
                  <span className="block text-xs text-[#9ca3af]">{e.work_order_items?.product_name} ×{e.work_order_items?.quantity}</span>
                </span>
                {e.status === "ACTIVE" && e.started_at && (
                  <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: ACCENT }}>
                    <Loader2 size={10} className="animate-spin" /> en cours
                  </span>
                )}
                <span className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold"
                  style={e.status === "ACTIVE"
                    ? { background: ACCENT_SOFT, color: ACCENT }
                    : e.status === "DONE"
                      ? { background: "rgba(74,124,89,.08)", color: "#4a7c59" }
                      : { background: "rgba(0,0,0,.04)", color: "#9ca3af" }}>
                  {statutFr(e.status)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
