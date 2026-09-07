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
  1: { name: "Atelier 1 · Woodworking", site: "Zone A — Site A", color: "from-fire to-fire-soft" },
  2: { name: "Atelier 2 · Assembly & Metal", site: "Zone A — Site A", color: "from-amber-400 to-fire-soft" },
  3: { name: "Atelier 3 · Finishing & QC", site: "Site B", color: "from-ice to-ice-soft" }
};

export default function RoadmapClient({ orders, steps, transfers, selectedId }: { orders: any[]; steps: any[]; transfers: any[]; selectedId: string }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"ALL" | 1 | 2 | 3>("ALL");
  const [busy, setBusy] = useState<string | null>(null);

  const visible = steps.filter((s) => filter === "ALL" || s.atelier_id === filter);
  const done = steps.filter((s) => s.status === "DONE").length;
  const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;
  const orderTransfers = transfers.filter((t) => t.order_id === selectedId);
  const selected = orders.find((o) => o.id === selectedId);

  return (
    <div className="stagger space-y-5">
      {/* order picker */}
      <div className="glass flex flex-wrap items-center gap-2 p-3">
        <span className="px-1 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">Order</span>
        <div className="flex flex-wrap gap-1.5">
          {orders.map((o: any) => (
            <button key={o.id} onClick={() => router.push(`/admin/roadmap?order=${o.id}`)}
              className={cn("rounded-xl border px-3 py-1.5 text-sm font-bold transition",
                o.id === selectedId ? "border-fire/40 bg-fire/15 text-white shadow-fire" : "border-white/10 text-zinc-400 hover:bg-white/5 hover:text-white")}>
              {o.order_number}
            </button>
          ))}
        </div>
        {selected && (
          <div className="ml-auto flex items-center gap-2 text-sm">
            <StatusPill status={selected.status} />
            <span className="text-zinc-400">{done}/{steps.length} · <b className="text-white">{pct}%</b></span>
          </div>
        )}
      </div>

      {/* progress river */}
      <GlassCard>
        <SectionTitle kicker="Journey" title={`${selected?.order_number ?? ""} — Site A → Site B`} hint="Progress river across the three ateliers." />
        <div className="mb-2 h-3 overflow-hidden rounded-full bg-white/5">
          <div className="h-full rounded-full bg-gradient-to-r from-fire via-fire-soft to-ice transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {[1, 2, 3].map((a) => {
            const mine = steps.filter((s) => s.atelier_id === a);
            const d = mine.filter((s) => s.status === "DONE").length;
            const m = ATELIER_META[a];
            return (
              <button key={a} onClick={() => setFilter(filter === a ? "ALL" : (a as 1 | 2 | 3))}
                className={cn("glass-soft p-3 text-left transition", filter === a && "border-fire/40")}>
                <p className="text-xs font-bold text-zinc-300">{m.name}</p>
                <p className="text-[11px] text-zinc-500">{m.site} · {d}/{mine.length} done</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div className={cn("h-full rounded-full bg-gradient-to-r", m.color)} style={{ width: mine.length ? `${(d / mine.length) * 100}%` : "0%" }} />
                </div>
              </button>
            );
          })}
        </div>
        {filter !== "ALL" && (
          <button onClick={() => setFilter("ALL")} className="btn-ghost mt-3 px-3 py-1.5 text-xs">Show all ateliers</button>
        )}
      </GlassCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <GlassCard>
          <SectionTitle kicker="Kanban" title="Live pipeline" hint={filter === "ALL" ? "All 30 steps." : `Filtered: Atelier ${filter}.`} />
          <LivePipeline steps={visible} />
        </GlassCard>
        <GlassCard>
          <SectionTitle kicker="Gantt" title="Time variance" hint="Actual vs target per step." />
          <GanttBoard steps={visible} />
        </GlassCard>
      </div>

      {/* transfers */}
      <GlassCard>
        <SectionTitle kicker="Logistics" title="Inter-site transfers" hint="Verify manifests arriving at Site B." />
        {orderTransfers.length === 0 ? (
          <p className="text-sm text-zinc-500">No manifests for this order yet — generate one from the order page.</p>
        ) : (
          <div className="grid gap-2.5 md:grid-cols-2">
            {orderTransfers.map((t: any) => (
              <div key={t.id} className="glass-soft flex items-center gap-3 p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-400/15 text-amber-300"><Truck size={19} /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-bold text-fire-soft">{t.manifest_qr}</p>
                  <p className="text-xs text-zinc-400">ADEMCO → MOBILIX · ×{t.item_count} items</p>
                  <div className="mt-1"><StatusPill status={t.status} /></div>
                </div>
                {t.status === "PENDING" && (
                  <button disabled={busy === t.id}
                    onClick={async () => { setBusy(t.id); await verifyTransfer(t.id, true); setBusy(null); router.refresh(); }}
                    className="btn-ice inline-flex shrink-0 items-center gap-1 px-3 py-2 text-xs">
                    <PackageCheck size={14} /> {busy === t.id ? "…" : "Verify"}
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
