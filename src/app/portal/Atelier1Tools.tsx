"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { statutFr } from "@/lib/fr";
import { ETAPES_A1 } from "@/lib/etapes";
import Link from "next/link";

type Etape = { id: string; step_order: number; step_name: string; status: string; estimated_minutes: number; started_at: string | null; work_order_items?: { product_name: string; quantity: number } | null };

// ── Portail ÉTAPE Atelier 1 : poste verrouillé sur l'étape ──
// Alimenté par DEP-MP centrale, produit vers Stock A1.
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

      // Stats pour cette étape
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

  const pct = stats.done + stats.active + stats.pending > 0
    ? Math.round((stats.done / (stats.done + stats.active + stats.pending)) * 100) : 0;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {/* Carte info étape */}
      <div className="glass rounded-2xl border-orange-400/30 p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-orange-300">
          {def ? `Atelier 1 — Étape ${def.ordre}/${ETAPES_A1.length}` : "Atelier 1 — Poste"}
        </p>
        <p className="mt-2 text-2xl font-black tracking-tight text-white">
          {def ? `${def.icone} ${def.nom}` : "🪚 Bois & Découpe"}
        </p>
        <p className="mt-1 text-sm text-zinc-400">
          {def ? def.description : "Découpe, usinage, préparation."}
        </p>
        {def && (
          <p className="mt-2 rounded-xl bg-orange-500/10 px-3 py-2 text-xs font-bold text-orange-200">📋 {def.consigne}</p>
        )}
        <div className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-xs text-zinc-300">
          📦 <span className="font-bold text-white">DEP-MP centrale</span> → alimente ce poste · Production → <span className="font-bold text-white">Stock A1</span>
        </div>

        {/* Barre de progression */}
        {!charge && (
          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400">
              <span>{stats.done} terminée{stats.done > 1 ? "s" : ""}</span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-300 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex gap-3 text-[11px] font-bold text-zinc-500">
              <span>🔄 {stats.active} en cours</span>
              <span>⏳ {stats.pending} en attente</span>
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {ETAPES_A1.map((e) => (
            <Link key={e.code} href={`/portal?atelier=1&etape=${e.ordre}`}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${e.ordre === etape ? "bg-orange-500/20 text-orange-200 ring-1 ring-orange-400/40" : "bg-white/5 text-zinc-400 hover:text-white"}`}>
              {e.icone} {e.ordre}
            </Link>
          ))}
        </div>
        <Link href="/portal?atelier=1" className="mt-3 inline-block rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-zinc-300 hover:text-white">
          ← Toutes les étapes A1
        </Link>
      </div>

      {/* File d'attente filtrée par étape */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">
            {def ? `File Étape ${def.ordre}` : "File Atelier 1"} · {lignes.length}
          </p>
          {def && <span className="rounded-full bg-orange-500/15 px-2.5 py-1 text-[10px] font-bold text-orange-200">{def.icone} {def.code}</span>}
        </div>
        {charge ? (
          <div className="mt-4 space-y-2">
            {[1,2,3].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-white/5" />)}
          </div>
        ) : lignes.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
            <p className="text-3xl">{def ? "✅" : "📭"}</p>
            <p className="mt-2 text-sm font-bold text-zinc-300">
              {def ? `Aucune pièce en attente pour ${def.nom}` : "Aucune étape en attente"}
            </p>
            <p className="mt-1 text-xs text-zinc-500">Toutes les pièces ont été traitées pour cette étape.</p>
          </div>
        ) : (
          <div className="mt-3 space-y-1.5">
            {lignes.map((e) => (
              <div key={e.id} className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition ${e.status === "ACTIVE" ? "border border-orange-400/30 bg-orange-500/10" : "bg-white/5"}`}>
                <span className="font-mono font-bold text-orange-300">#{e.step_order}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-white">{e.step_name}</span>
                  <span className="block text-xs text-zinc-400">{e.work_order_items?.product_name} ×{e.work_order_items?.quantity}</span>
                </span>
                {e.status === "ACTIVE" && e.started_at && (
                  <span className="text-[10px] font-bold text-orange-300">🔥 en cours</span>
                )}
                <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold ${e.status === "ACTIVE" ? "bg-orange-500/20 text-orange-200" : "bg-white/10 text-zinc-200"}`}>
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
