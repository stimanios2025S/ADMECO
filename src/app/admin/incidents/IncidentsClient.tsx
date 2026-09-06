"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Flame, AlarmClock, Truck, CheckCheck } from "lucide-react";
import { GlassCard, SectionTitle, Stat, Empty } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

type Props = { scrap: any[]; overdue: any[]; shortages: any[] };

export default function IncidentsClient({ scrap, overdue, shortages }: Props) {
  const [tab, setTab] = useState<"scrap" | "overdue" | "shortage">("scrap");
  const [dismissed, setDismissed] = useState<string[]>([]);
  const total = scrap.length + overdue.length + shortages.length;

  const live = useMemo(() => ({
    scrap: scrap.filter((s) => !dismissed.includes(`s-${s.id}`)),
    overdue: overdue.filter((s) => !dismissed.includes(`o-${s.id}`)),
    shortage: shortages.filter((s) => !dismissed.includes(`t-${s.id}`))
  }), [scrap, overdue, shortages, dismissed]);

  const TABS = [
    { id: "scrap" as const, label: `Scrap (${live.scrap.length})`, icon: Flame },
    { id: "overdue" as const, label: `Overdue (${live.overdue.length})`, icon: AlarmClock },
    { id: "shortage" as const, label: `Shortages (${live.shortage.length})`, icon: Truck }
  ];

  return (
    <div className="stagger space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Open incidents" value={String(total)} sub="Across all orders" accent={total > 0 ? "red" : "green"} />
        <Stat label="Scrap > 5%" value={String(scrap.length)} sub="Material loss overruns" accent="fire" />
        <Stat label="Overdue steps" value={String(overdue.length)} sub="Past target time" accent="red" />
        <Stat label="Shortages" value={String(shortages.length)} sub="Transfer mismatches" accent="ice" />
      </div>

      <div className="glass flex flex-wrap gap-1.5 p-2">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-bold transition",
              tab === t.id ? "border-fire/40 bg-fire/15 text-white shadow-fire" : "border-white/10 text-zinc-400 hover:text-white")}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "scrap" && (
        <GlassCard>
          <SectionTitle kicker="Material loss" title="Scrap overruns" hint="Scrap % = scrap ÷ (good + scrap) × 100. Limit: 5%." />
          {live.scrap.length === 0 ? <Empty icon="✅" title="No scrap overruns" hint="Every batch is within the 5% limit." /> : (
            <div className="grid gap-2.5 md:grid-cols-2">
              {live.scrap.map((s: any) => (
                <IncidentRow key={s.id} icon="🗑️" title={`#${s.step_order} ${s.step_name}`}
                  meta={`${s.work_orders?.order_number} · Good ${s.good_units} / Scrap ${s.scrap_units} / Expected ${s.expected_units}`}
                  badge={`${Number(s.scrap_pct).toFixed(1)}%`} badgeTone="fire" orderId={s.work_order_id}
                  onDone={() => setDismissed((d) => [...d, `s-${s.id}`])} />
              ))}
            </div>
          )}
        </GlassCard>
      )}

      {tab === "overdue" && (
        <GlassCard>
          <SectionTitle kicker="Time variance" title="Overdue steps" hint="Actual minutes past the estimated target." />
          {live.overdue.length === 0 ? <Empty icon="⏱️" title="Nothing overdue" hint="All active steps are within target time." /> : (
            <div className="grid gap-2.5 md:grid-cols-2">
              {live.overdue.map((s: any) => (
                <IncidentRow key={s.id} icon="🔴" title={`#${s.step_order} ${s.step_name}`}
                  meta={`${s.work_orders?.order_number} · Actual ${Number(s.actual_minutes).toFixed(0)} min vs target ${s.estimated_minutes} min`}
                  badge={`+${Number(s.variance_min).toFixed(0)}m`} badgeTone="red" orderId={s.work_order_id}
                  onDone={() => setDismissed((d) => [...d, `o-${s.id}`])} />
              ))}
            </div>
          )}
        </GlassCard>
      )}

      {tab === "shortage" && (
        <GlassCard>
          <SectionTitle kicker="Logistics" title="Transfer shortages" hint="Manifests flagged with missing items at Site B." />
          {live.shortage.length === 0 ? <Empty icon="🚚" title="No shortages" hint="All manifests verified complete." /> : (
            <div className="grid gap-2.5 md:grid-cols-2">
              {live.shortage.map((t: any) => (
                <IncidentRow key={t.id} icon="📦" title={t.manifest_qr}
                  meta={`${t.work_orders?.order_number} · A${t.from_atelier} → A${t.to_atelier} · ×${t.item_count}`} badge="SHORTAGE"
                  badgeTone="ice" orderId={t.work_order_id} onDone={() => setDismissed((d) => [...d, `t-${t.id}`])} />
              ))}
            </div>
          )}
        </GlassCard>
      )}
    </div>
  );
}

function IncidentRow({ icon, title, meta, badge, badgeTone, orderId, onDone }: {
  icon: string; title: string; meta: string; badge: string;
  badgeTone: "fire" | "red" | "ice"; orderId: string; onDone: () => void;
}) {
  const tone = badgeTone === "fire" ? "bg-fire/20 border-fire/30 text-fire-soft"
    : badgeTone === "red" ? "bg-red-500/20 border-red-400/30 text-red-300"
    : "bg-ice/20 border-ice/30 text-ice-soft";
  return (
    <div className="glass-soft flex items-center gap-3 p-3.5">
      <span className="text-2xl">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{title}</p>
        <p className="truncate text-xs text-zinc-500">{meta}</p>
        <div className="mt-1.5 flex gap-2">
          <Link href={`/orders/${orderId}`} className="text-xs font-bold text-ice-soft hover:underline">Inspect order →</Link>
          <button onClick={onDone} className="inline-flex items-center gap-1 text-xs font-bold text-emerald-300 hover:underline">
            <CheckCheck size={13} /> Acknowledge
          </button>
        </div>
      </div>
      <span className={cn("shrink-0 rounded-lg border px-2 py-1 text-xs font-black", tone)}>{badge}</span>
    </div>
  );
}
