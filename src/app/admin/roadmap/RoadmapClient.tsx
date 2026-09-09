"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Truck, PackageCheck } from "lucide-react";
import { GlassCard, SectionTitle, StatusPill } from "@/components/admin/ui";
import LivePipeline from "@/components/admin/LivePipeline";
import GanttBoard from "@/components/admin/GanttBoard";
import { verifyTransfer } from "@/app/actions";
import { cn } from "@/lib/utils";

const ATELIER_META: Record<number, { name: string; site: string; color: string }> = {
  1: { name: "Atelier 1 — Bois & Découpe", site: "ADMEDCO", color: "from-[#c24a08] to-[#c24a08]" },
  2: { name: "Atelier 2 — Assemblage & Finition", site: "ADMEDCO", color: "from-[#2f6eb5] to-[#2f6eb5]" },
};

export default function RoadmapClient({ orders, steps, transfers, selectedId }: { orders: any[]; steps: any[]; transfers: any[]; selectedId: string }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"ALL" | 1 | 2>("ALL");
  const [busy, setBusy] = useState<string | null>(null);

  const visible = steps.filter((s) => filter === "ALL" || s.atelier_id === filter);
  const done = steps.filter((s) => s.status === "DONE").length;
  const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;
  const orderTransfers = transfers.filter((t) => t.order_id === selectedId);
  const selected = orders.find((o) => o.id === selectedId);

  return (
    <div className="stagger space-y-5">
      {/* sélecteur commande */}
      <div className="card flex flex-wrap items-center gap-2 p-3">
        <span className="px-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[#7c8091]">Commande</span>
        <div className="flex flex-wrap gap-1.5">
          {orders.map((o: any) => (
            <button key={o.id} onClick={() => router.push(`/admin/roadmap?order=${o.id}`)}
              className={cn("rounded-xl border px-3 py-1.5 text-sm font-bold transition",
                o.id === selectedId ? "border-[#c24a08]/40 bg-[#c24a08]/10 text-[#c24a08]" : "border-[#e6e1d8] text-[#7c8091] hover:bg-[#f8f7f5] hover:text-[#1a1d23]")}>
              {o.order_number}
            </button>
          ))}
        </div>
        {selected && (
          <div className="ml-auto flex items-center gap-2 text-sm">
            <StatusPill status={selected.status} />
            <span className="text-[#7c8091]">{done}/{steps.length} · <b className="text-[#1a1d23]">{pct}%</b></span>
          </div>
        )}
      </div>

      {/* rivière de progression */}
      <GlassCard>
        <SectionTitle kicker="Parcours" title={`${selected?.order_number ?? ""} — Atelier 1 → Atelier 2`} hint="Rivière de progression entre les deux ateliers." />
        <div className="mb-2 h-3 overflow-hidden rounded-full bg-[#f0ede8]">
          <div className="h-full rounded-full bg-gradient-to-r from-[#c24a08] via-[#c24a08] to-[#2f6eb5] transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {[1, 2].map((a) => {
            const mine = steps.filter((s) => s.atelier_id === a);
            const d = mine.filter((s) => s.status === "DONE").length;
            const m = ATELIER_META[a];
            return (
              <button key={a} onClick={() => setFilter(filter === a ? "ALL" : (a as 1 | 2))}
                className={cn("card p-3 text-left transition", filter === a && "border-[#c24a08]/40")}>
                <p className="text-xs font-bold text-[#1a1d23]">{m.name}</p>
                <p className="text-[11px] text-[#7c8091]">{m.site} · {d}/{mine.length} terminées</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#f0ede8]">
                  <div className={cn("h-full rounded-full bg-gradient-to-r", m.color)} style={{ width: mine.length ? `${(d / mine.length) * 100}%` : "0%" }} />
                </div>
              </button>
            );
          })}
        </div>
        {filter !== "ALL" && (
          <button onClick={() => setFilter("ALL")} className="btn-ghost mt-3 px-3 py-1.5 text-xs">Voir les deux ateliers</button>
        )}
      </GlassCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <GlassCard>
          <SectionTitle kicker="Kanban" title="Pipeline en direct" hint={filter === "ALL" ? "Toutes les étapes." : `Filtré : Atelier ${filter}.`} />
          <LivePipeline steps={visible} />
        </GlassCard>
        <GlassCard>
          <SectionTitle kicker="Gantt" title="Écarts de temps" hint="Réel vs cible par étape." />
          <GanttBoard steps={visible} />
        </GlassCard>
      </div>

      {/* transferts */}
      <GlassCard>
        <SectionTitle kicker="Logistique" title="Transferts entre ateliers" hint="Vérifiez les bordereaux à l'arrivée Atelier 2." />
        {orderTransfers.length === 0 ? (
          <p className="text-sm text-[#7c8091]">Aucun bordereau pour cette commande — générez-en un depuis la page commande.</p>
        ) : (
          <div className="grid gap-2.5 md:grid-cols-2">
            {orderTransfers.map((t: any) => (
              <div key={t.id} className="card flex items-center gap-3 p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600"><Truck size={19} /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-bold text-[#c24a08]">{t.manifest_qr}</p>
                  <p className="text-xs text-[#7c8091]">Atelier 1 → Atelier 2 · ×{t.item_count} articles</p>
                  <div className="mt-1"><StatusPill status={t.status} /></div>
                </div>
                {t.status === "PENDING" && (
                  <button disabled={busy === t.id}
                    onClick={async () => { setBusy(t.id); await verifyTransfer(t.id, true); setBusy(null); router.refresh(); }}
                    className="btn-ice inline-flex shrink-0 items-center gap-1 px-3 py-2 text-xs">
                    <PackageCheck size={14} /> {busy === t.id ? "…" : "Vérifier"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
