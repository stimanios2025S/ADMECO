"use client";
import Link from "next/link";
import { Package, CheckCircle2, Truck, AlertTriangle, Archive, ArrowUpRight, Clock } from "lucide-react";
import { GlassCard, SectionTitle, Stat, StatusPill, Empty } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

type Props = {
  kpi: { activeOrders: number; totalItems: number; readyItems: number; lowStock: number; pendingSemi: number; overdueSteps: number; transfers: number; totalStock: number };
  orders: any[]; stocks: any[]; transfers: any[];
};

export default function DashboardClient({ kpi, orders, stocks, transfers }: Props) {
  return (
    <div className="stagger space-y-5">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div className="glass flex items-center gap-3 p-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-fire to-fire-soft text-[#1a0d02] shadow-fire"><Package size={20} /></span>
          <div><p className="text-2xl font-black">{kpi.activeOrders}</p><p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Active orders</p></div>
        </div>
        <div className="glass flex items-center gap-3 p-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-ice to-ice-soft text-[#04121f] shadow-ice"><CheckCircle2 size={20} /></span>
          <div><p className="text-2xl font-black">{kpi.readyItems}/{kpi.totalItems}</p><p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Items ready</p></div>
        </div>
        <div className="glass flex items-center gap-3 p-4">
          <span className={cn("grid h-11 w-11 place-items-center rounded-xl", kpi.lowStock > 0 ? "bg-red-400/15 text-red-300" : "bg-emerald-400/15 text-emerald-300")}>
            {kpi.lowStock > 0 ? <AlertTriangle size={20} /> : <Archive size={20} />}
          </span>
          <div><p className="text-2xl font-black">{kpi.totalStock}</p><p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">{kpi.lowStock > 0 ? `${kpi.lowStock} low stock` : 'Stock OK'}</p></div>
        </div>
        <div className="glass flex items-center gap-3 p-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-400/15 text-amber-300"><Truck size={20} /></span>
          <div><p className="text-2xl font-black">{kpi.pendingSemi}</p><p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Ready for MOBILIX</p></div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <GlassCard className="lg:col-span-2">
          <SectionTitle kicker="Production" title="Recent orders" hint="Click any order to see full detail."
            right={<Link href="/admin/orders/new" className="btn-fire inline-flex items-center gap-1 px-4 py-2 text-sm">+ New order</Link>} />
          {orders.length === 0 ? <Empty icon="📦" title="No orders" hint="Create your first production order." /> : (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {orders.slice(0, 6).map((o: any) => (
                <Link key={o.id} href={`/admin/orders/${o.id}`} className="glass-soft group p-4 transition hover:border-fire/30">
                  <div className="flex items-center justify-between">
                    <span className="truncate font-black">{o.order_number}</span>
                    <StatusPill status={o.status} />
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">{new Date(o.created_at).toLocaleDateString("fr-FR")}</p>
                  <p className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-fire-soft opacity-0 transition group-hover:opacity-100">
                    View details <ArrowUpRight size={13} />
                  </p>
                </Link>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard>
          <SectionTitle kicker="Stocks" title="Materials overview" hint="Stock health at a glance." />
          {stocks.length === 0 ? <Empty icon="📦" title="No stock items" /> : (
            <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
              {stocks.slice(0, 8).map((s: any) => (
                <div key={s.id} className="glass-soft flex items-center gap-2.5 p-2.5">
                  <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", s.low_stock ? "bg-red-400" : "bg-emerald-400")} />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{s.name}</span>
                  <span className="font-mono text-xs text-zinc-400">{s.quantity} {s.unit}</span>
                </div>
              ))}
              <Link href="/admin/stocks" className="text-xs font-bold text-ice-soft hover:underline">View all stocks →</Link>
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
