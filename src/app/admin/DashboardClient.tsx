"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, CheckCircle2, AlarmClock, Flame, Truck, ArrowUpRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeSteps } from "@/hooks/useRealtimeSteps";
import { GlassCard, SectionTitle, Stat, StatusPill, Empty } from "@/components/admin/ui";
import CreateOrderDialog from "@/components/admin/CreateOrderDialog";

type Props = {
  kpi: { activeOrders: number; totalOrders: number; stepsDone: number; stepsTotal: number; overdue: number; scrapAlerts: number; inTransit: number };
  orders: any[];
  categories: { id: string; name: string }[];
  transfers: any[];
  badSteps: any[];
};

export default function DashboardClient({ kpi: initial, orders: initialOrders, categories, transfers: initialTransfers, badSteps: initialBad }: Props) {
  const tick = useRealtimeSteps();
  const [kpi, setKpi] = useState(initial);
  const [orders, setOrders] = useState(initialOrders);
  const [transfers, setTransfers] = useState(initialTransfers);
  const [bad, setBad] = useState(initialBad);

  useEffect(() => {
    if (tick === 0) return;
    (async () => {
      const supabase = createClient();
      const { data: o } = await supabase.from("work_orders").select("*, product_categories(name)").order("created_at", { ascending: false }).limit(50);
      if (o) {
        setOrders(o);
        setKpi((k) => ({ ...k, activeOrders: o.filter((x: any) => x.status !== "COMPLETED").length, totalOrders: o.length }));
      }
      const { data: t } = await supabase.from("site_transfers").select("*, work_orders(order_number)").order("id", { ascending: false }).limit(10);
      if (t) { setTransfers(t); setKpi((k) => ({ ...k, inTransit: t.filter((x: any) => x.status === "IN_TRANSIT").length })); }
      const { data: b } = await supabase.from("v_step_variance").select("*").gt("scrap_pct", 5).order("scrap_pct", { ascending: false }).limit(8);
      if (b) { setBad(b); setKpi((k) => ({ ...k, scrapAlerts: b.length })); }
    })();
  }, [tick]);

  const completion = kpi.stepsTotal > 0 ? Math.round((kpi.stepsDone / kpi.stepsTotal) * 100) : 0;

  return (
    <div className="stagger space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <div className="glass flex items-center gap-3 p-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-fire to-fire-soft text-[#1a0d02] shadow-fire"><Package size={20} /></span>
          <div><p className="text-2xl font-black">{kpi.activeOrders}</p><p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Active orders</p></div>
        </div>
        <div className="glass flex items-center gap-3 p-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-ice to-ice-soft text-[#04121f] shadow-ice"><CheckCircle2 size={20} /></span>
          <div><p className="text-2xl font-black">{completion}%</p><p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Steps done</p></div>
        </div>
        <div className="glass flex items-center gap-3 p-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-red-400/15 text-red-300"><AlarmClock size={20} /></span>
          <div><p className="text-2xl font-black">{kpi.overdue}</p><p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Overdue steps</p></div>
        </div>
        <div className="glass flex items-center gap-3 p-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-fire/15 text-fire-soft"><Flame size={20} /></span>
          <div><p className="text-2xl font-black">{kpi.scrapAlerts}</p><p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Scrap alerts</p></div>
        </div>
        <div className="glass col-span-2 flex items-center gap-3 p-4 xl:col-span-1">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-400/15 text-amber-300"><Truck size={20} /></span>
          <div><p className="text-2xl font-black">{kpi.inTransit}</p><p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">In transit</p></div>
        </div>
      </div>

      {/* alerts */}
      {bad.length > 0 && (
        <GlassCard className="border-red-400/25 bg-gradient-to-r from-red-500/10 to-transparent">
          <SectionTitle kicker="Attention" title="Scrap alerts — live" hint="Any batch losing more than 5% of material." />
          <div className="grid gap-2 md:grid-cols-2">
            {bad.map((a: any) => (
              <div key={a.id} className="glass-soft flex items-center gap-3 p-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-red-400/15 text-lg">⚠️</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{a.step_name}</p>
                  <p className="text-xs text-zinc-400">Good {a.good_units} · Scrap {a.scrap_units}</p>
                </div>
                <span className="rounded-lg bg-red-500 px-2 py-1 text-xs font-black">{Number(a.scrap_pct).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* orders */}
        <GlassCard className="lg:col-span-2">
          <SectionTitle kicker="Production" title="Work orders" hint="Click any order for its live pipeline." right={<CreateOrderDialog categories={categories} />} />
          {orders.length === 0 ? (
            <Empty icon="📦" title="No work orders yet" hint="Create your first order to instance a routing template." />
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {orders.slice(0, 8).map((o: any) => (
                <Link key={o.id} href={`/orders/${o.id}`} className="glass-soft group p-4 transition hover:border-fire/30">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-black">{o.order_number}</span>
                    <StatusPill status={o.status} />
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">{o.product_categories?.name} · target ×{o.target_quantity}</p>
                  <p className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-fire-soft opacity-0 transition group-hover:opacity-100">
                    Open pipeline <ArrowUpRight size={13} />
                  </p>
                </Link>
              ))}
            </div>
          )}
          {orders.length > 8 && (
            <Link href="/admin/roadmap" className="btn-ghost mt-3 inline-block px-4 py-2 text-sm">View all {orders.length} orders →</Link>
          )}
        </GlassCard>

        {/* transfers */}
        <GlassCard>
          <SectionTitle kicker="Logistics" title="Site transfers" hint="Site A → Site B manifests." />
          {transfers.length === 0 ? (
            <Empty icon="🚚" title="No transfers yet" hint="Generate a pallet manifest from an order." />
          ) : (
            <div className="space-y-2">
              {transfers.slice(0, 6).map((t: any) => (
                <div key={t.id} className="glass-soft p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-fire-soft">{t.manifest_qr}</span>
                    <StatusPill status={t.status} />
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">{t.work_orders?.order_number} · A{t.from_atelier} → A{t.to_atelier} · ×{t.item_count}</p>
                </div>
              ))}
              <Link href="/admin/roadmap" className="text-xs font-bold text-ice-soft hover:underline">Track in Roadmap →</Link>
            </div>
          )}
        </GlassCard>
      </div>

      {/* stats strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total orders" value={String(kpi.totalOrders)} sub="All time in system" />
        <Stat label="Steps completed" value={`${kpi.stepsDone}/${kpi.stepsTotal}`} sub={`${completion}% throughput`} accent="ice" />
        <Stat label="Overdue steps" value={String(kpi.overdue)} sub="Exceeding target time" accent={kpi.overdue > 0 ? "red" : undefined} />
        <Stat label="In transit" value={String(kpi.inTransit)} sub="Manifests on the road" accent="fire" />
      </div>
    </div>
  );
}
