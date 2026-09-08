"use client";
import Link from "next/link";
import { Package, CheckCircle2, Truck, AlertTriangle, Archive, ArrowUpRight, Sparkles, Gauge } from "lucide-react";
import { GlassCard, SectionTitle, Stat, StatusPill, Empty } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

type Props = {
  kpi: { activeOrders: number; totalItems: number; readyItems: number; lowStock: number; pendingSemi: number; overdueSteps: number; transfers: number; totalStock: number };
  orders: any[]; stocks: any[]; transfers: any[];
};

export default function DashboardClient({ kpi, orders, stocks, transfers }: Props) {
  return (
    <div className="stagger space-y-5">
      <div className="premium-card relative overflow-hidden rounded-[26px] p-5 sm:p-6">
        <div className="absolute -right-8 -top-12 h-40 w-40 rounded-full bg-fire/15 blur-3xl" />
        <div className="absolute -bottom-10 left-10 h-32 w-32 rounded-full bg-ice/15 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-ice/25 bg-ice/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-ice-soft">
              <Sparkles size={12} /> Operations overview
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-zinc-500">Performance</p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.06em] text-white sm:text-4xl">Plant performance is <span className="text-fire">stable</span> and moving fast.</h2>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-400/25 to-emerald-300/10 text-emerald-300">
              <Gauge size={18} />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Throughput</p>
              <p className="text-xl font-black text-white">{kpi.readyItems}/{kpi.totalItems} items ready</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div className="glass rounded-[22px] p-4">
          <div className="flex items-center justify-between">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-fire to-fire-soft text-[#1a0d02] shadow-[0_18px_35px_rgba(255,122,26,0.25)]"><Package size={20} /></span>
            <span className="rounded-full border border-fire/20 bg-fire/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-fire-soft">Live</span>
          </div>
          <p className="mt-4 text-3xl font-black tracking-tight text-white">{kpi.activeOrders}</p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Active orders</p>
        </div>

        <div className="glass rounded-[22px] p-4">
          <div className="flex items-center justify-between">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-ice to-ice-soft text-[#081825] shadow-[0_18px_35px_rgba(92,141,255,0.25)]"><CheckCircle2 size={20} /></span>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">Ready</span>
          </div>
          <p className="mt-4 text-3xl font-black tracking-tight text-white">{kpi.readyItems}/{kpi.totalItems}</p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Items ready</p>
        </div>

        <div className="glass rounded-[22px] p-4">
          <div className="flex items-center justify-between">
            <span className={cn("grid h-11 w-11 place-items-center rounded-xl", kpi.lowStock > 0 ? "bg-red-400/15 text-red-300" : "bg-emerald-400/15 text-emerald-300")}>
              {kpi.lowStock > 0 ? <AlertTriangle size={20} /> : <Archive size={20} />}
            </span>
            <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em]", kpi.lowStock > 0 ? "border-red-400/20 bg-red-500/10 text-red-300" : "border-emerald-400/20 bg-emerald-500/10 text-emerald-300")}>{kpi.lowStock > 0 ? "Alert" : "OK"}</span>
          </div>
          <p className="mt-4 text-3xl font-black tracking-tight text-white">{kpi.totalStock}</p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">{kpi.lowStock > 0 ? `${kpi.lowStock} low stock` : "Stock OK"}</p>
        </div>

        <div className="glass rounded-[22px] p-4">
          <div className="flex items-center justify-between">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-400/15 text-amber-300"><Truck size={20} /></span>
            <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">Dispatch</span>
          </div>
          <p className="mt-4 text-3xl font-black tracking-tight text-white">{kpi.pendingSemi}</p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Ready for MOBILIX</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <GlassCard className="lg:col-span-2 rounded-[24px]">
          <SectionTitle
            kicker="Production"
            title="Recent orders"
            hint="Click any order to see full detail."
            right={<Link href="/admin/orders/new" className="btn-fire inline-flex items-center gap-1 px-4 py-2 text-sm">+ New order</Link>}
          />

          {orders.length === 0 ? <Empty icon="📦" title="No orders" hint="Create your first production order." /> : (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {orders.slice(0, 6).map((o: any) => (
                <Link key={o.id} href={`/admin/orders/${o.id}`} className="glass-soft group relative overflow-hidden p-4 transition duration-200 hover:border-fire/30 hover:bg-white/5">
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fire/50 to-transparent" />
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-black text-white">{o.order_number}</span>
                    <StatusPill status={o.status} />
                  </div>
                  <p className="mt-2 text-xs text-zinc-400">{new Date(o.created_at).toLocaleDateString("fr-FR")}</p>
                  <p className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-fire-soft opacity-0 transition group-hover:opacity-100">
                    View details <ArrowUpRight size={13} />
                  </p>
                </Link>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard className="rounded-[24px]">
          <SectionTitle kicker="Stocks" title="Materials overview" hint="Stock health at a glance." />
          {stocks.length === 0 ? <Empty icon="📦" title="No stock items" /> : (
            <div className="max-h-[360px] space-y-1.5 overflow-y-auto pr-1">
              {stocks.slice(0, 8).map((s: any) => (
                <div key={s.id} className="glass-soft flex items-center gap-2.5 p-2.5">
                  <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", s.low_stock ? "bg-red-400" : "bg-emerald-400")} />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-white">{s.name}</span>
                  <span className="font-mono text-xs text-zinc-400">{s.quantity} {s.unit}</span>
                </div>
              ))}
              <Link href="/admin/stocks" className="inline-flex items-center gap-1 pt-2 text-xs font-bold text-ice-soft hover:underline">View all stocks <ArrowUpRight size={12} /></Link>
            </div>
          )}
        </GlassCard>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Transfers" value={String(kpi.transfers)} sub="To MOBILIX" accent="ice" />
        <Stat label="Overdue steps" value={String(kpi.overdueSteps)} sub="Past target" accent={kpi.overdueSteps > 0 ? "red" : "green"} />
        <Stat label="Stock items" value={String(kpi.totalStock)} sub="Raw materials" />
        <Stat label="Semi-finished" value={String(kpi.pendingSemi)} sub="Pending release" accent="fire" />
      </div>
    </div>
  );
}
