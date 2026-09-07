"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Truck, ChevronDown, ChevronRight } from "lucide-react";
import { GlassCard, SectionTitle, StatusPill } from "@/components/admin/ui";
import LivePipeline from "@/components/admin/LivePipeline";
import GanttBoard from "@/components/admin/GanttBoard";
import { releaseToMobilix } from "@/app/actions";

export default function OrderDetailClient({ orderId, orderStatus, items, stepsByItem, transfers }: {
  orderId: string; orderStatus: string; items: any[]; stepsByItem: Map<string, any[]>; transfers: any[];
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(items[0]?.id ?? null);
  const [busy, setBusy] = useState(false);

  const readyItems = items.filter((i) => i.status === "SEMI_READY");

  return (
    <div className="stagger space-y-5">
      {readyItems.length > 0 && (
        <GlassCard className="border-emerald-400/30 bg-gradient-to-r from-emerald-500/10 to-transparent">
          <SectionTitle kicker="Release" title={`${readyItems.length} item(s) ready for MOBILIX`}
            hint="All semi-finished products are waiting for your confirmation."
            right={
              <button disabled={busy} onClick={async () => { setBusy(true); await releaseToMobilix(orderId); setBusy(false); router.refresh(); }}
                className="btn-fire inline-flex items-center gap-1.5 px-5 py-2.5 text-sm">
                <Truck size={16} /> {busy ? "Releasing…" : `Release ${readyItems.length} item(s) to MOBILIX`}
              </button>
            } />
        </GlassCard>
      )}

      {transfers.length > 0 && (
        <GlassCard>
          <SectionTitle kicker="Logistics" title="Transfers to MOBILIX" />
          {transfers.map((t: any) => (
            <div key={t.id} className="glass-soft flex items-center gap-3 p-3">
              <StatusPill status={t.status} />
              <span className="font-mono text-sm font-bold text-fire-soft">{t.manifest_qr}</span>
              <span className="text-xs text-zinc-400">{t.item_count} items · {new Date(t.created_at).toLocaleString("fr-FR")}</span>
            </div>
          ))}
        </GlassCard>
      )}

      <GlassCard>
        <SectionTitle kicker="Products" title="Order items & production progress" />
        <div className="space-y-2">
          {items.map((item) => {
            const steps = stepsByItem.get(item.id) ?? [];
            const done = steps.filter((s: any) => s.status === "DONE").length;
            const isExpanded = expanded === item.id;
            return (
              <div key={item.id} className="glass-soft overflow-hidden">
                <button onClick={() => setExpanded(isExpanded ? null : item.id)}
                  className="flex w-full items-center gap-3 p-3.5 text-left">
                  {isExpanded ? <ChevronDown size={16} className="text-zinc-400" /> : <ChevronRight size={16} className="text-zinc-400" />}
                  <span className="min-w-0 flex-1 truncate font-bold">{item.product_name}</span>
                  <span className="text-xs text-zinc-500">×{item.quantity}</span>
                  <span className="text-xs text-zinc-500">{item.product_categories?.name}</span>
                  {item.dimensions && Object.values(item.dimensions).some(Boolean) && (
                    <span className="hidden text-xs text-zinc-500 sm:block">
                      {item.dimensions.length}×{item.dimensions.width}×{item.dimensions.height} cm
                    </span>
                  )}
                  <StatusPill status={item.status} />
                  <span className="ml-1 text-xs font-bold text-zinc-400">{done}/{steps.length}</span>
                </button>
                {isExpanded && (
                  <div className="border-t border-white/5 p-4 space-y-4">
                    {item.design_notes && <p className="text-xs text-zinc-400">Design: {item.design_notes}</p>}
                    <div className="grid gap-5 lg:grid-cols-2">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Live pipeline</p>
                        <LivePipeline steps={steps} />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Gantt</p>
                        <GanttBoard steps={steps} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
}
