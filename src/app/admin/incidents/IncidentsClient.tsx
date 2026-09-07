"use client";
import { useState } from "react";
import Link from "next/link";
import { AlarmClock, Package, Truck, CheckCheck } from "lucide-react";
import { GlassCard, SectionTitle, Stat, StatusPill, Empty } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

type Props = { overdue: any[]; transfers: any[]; lowStock: any[] };

export default function IncidentsClient({ overdue, transfers, lowStock }: Props) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const liveOverdue = overdue.filter((s) => !dismissed.includes(s.id));
  const total = liveOverdue.length + lowStock.length + transfers.filter((t) => t.status === "VERIFIED").length;

  return (
    <div className="stagger space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Open incidents" value={String(total)} sub="Across platform" accent={total > 0 ? "red" : "green"} />
        <Stat label="Overdue steps" value={String(liveOverdue.length)} sub="Past target time" accent="fire" />
        <Stat label="Low stock" value={String(lowStock.length)} sub="Below threshold" accent={lowStock.length > 0 ? "red" : "green"} />
        <Stat label="Transfers" value={String(transfers.length)} sub="To MOBILIX" accent="ice" />
      </div>

      {/* Overdue */}
      <GlassCard>
        <SectionTitle kicker="Time" title="Overdue steps" hint="Steps that exceeded their estimated time." />
        {liveOverdue.length === 0 ? <Empty icon="⏱️" title="Nothing overdue" hint="All steps are within target." /> : (
          <div className="grid gap-2.5 md:grid-cols-2">
            {liveOverdue.map((s: any) => (
              <div key={s.id} className="glass-soft flex items-center gap-3 p-3.5">
                <span className="text-2xl">🔴</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">#{s.step_order} {s.step_name}</p>
                  <p className="text-xs text-zinc-500">Actual {Number(s.actual_minutes).toFixed(0)} min vs target {s.estimated_minutes} min</p>
                </div>
                <span className="rounded-lg bg-red-500/20 border border-red-400/30 px-2 py-1 text-xs font-black text-red-300">
                  +{Number(s.variance_min).toFixed(0)}m
                </span>
                <button onClick={() => setDismissed((d) => [...d, s.id])} className="text-xs font-bold text-emerald-300 hover:underline" title="Acknowledge">
                  <CheckCheck size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Low stock */}
      <GlassCard>
        <SectionTitle kicker="Stock" title="Low stock alerts" hint="Materials below their alert threshold." />
        {lowStock.length === 0 ? <Empty icon="✅" title="Stock is healthy" hint="All materials above threshold." /> : (
          <div className="grid gap-2.5 md:grid-cols-2">
            {lowStock.map((s: any) => (
              <div key={s.id} className="glass-soft flex items-center gap-3 p-3.5">
                <span className="text-2xl">⚠️</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{s.name}</p>
                  <p className="text-xs text-zinc-500">{s.quantity} {s.unit} remaining · threshold {s.alert_threshold}</p>
                </div>
                <Link href="/admin/stocks" className="text-xs font-bold text-ice-soft hover:underline">Restock →</Link>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Transfers */}
      <GlassCard>
        <SectionTitle kicker="Logistics" title="Transfers to MOBILIX" hint="Manifest status for released products." />
        {transfers.length === 0 ? <Empty icon="🚚" title="No transfers yet" hint="Release items from orders to send to MOBILIX." /> : (
          <div className="space-y-2">
            {transfers.map((t: any) => (
              <div key={t.id} className="glass-soft flex items-center gap-3 p-3.5">
                <StatusPill status={t.status} />
                <span className="font-mono text-sm font-bold text-fire-soft">{t.manifest_qr}</span>
                <span className="text-xs text-zinc-400">{t.work_orders?.order_number} · {t.item_count} items</span>
                <span className="ml-auto text-xs text-zinc-500">{new Date(t.created_at).toLocaleString("fr-FR")}</span>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
