"use client";
import { useMemo } from "react";
import Link from "next/link";
import { Package, CheckCircle2, Truck, AlertTriangle, Warehouse, ArrowUpRight, TrendingUp, Clock, ArrowRight } from "lucide-react";
import { GlassCard, SectionTitle, StatusPill, Empty } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

type Props = {
  kpi: { activeOrders: number; totalItems: number; readyItems: number; lowStock: number; pendingSemi: number; overdueSteps: number; transfers: number; totalStock: number };
  orders: any[]; stocks: any[]; transfers: any[];
};

// Mini sparkline bars
function SparkBars({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(1, ...data);
  return (
    <div className="flex items-end gap-[3px] h-8">
      {data.map((v, i) => (
        <div key={i} className={cn("w-[5px] rounded-full transition-all duration-500", color)}
          style={{ height: `${Math.max(8, (v / max) * 100)}%`, opacity: 0.35 + (i / data.length) * 0.65 }} />
      ))}
    </div>
  );
}

// Simple SVG line chart
function MiniLineChart({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const max = Math.max(1, ...data);
  const min = Math.min(0, ...data);
  const range = max - min || 1;
  const w = 180, h = 50, pad = 4;
  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12" fill="none">
      <polyline points={points} stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Donut gauge
function DonutGauge({ pct, color, label }: { pct: number; color: string; label: string }) {
  const r = 44, c = 2 * Math.PI * r;
  const filled = (pct / 100) * c;
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#f0ede8" strokeWidth="8" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${filled} ${c - filled}`} strokeLinecap="round"
          transform="rotate(-90 50 50)" className="transition-all duration-1000" />
        <text x="50" y="50" textAnchor="middle" dominantBaseline="central" className="text-[18px] font-black" fill="#1a1d23">
          {pct}%
        </text>
      </svg>
      <p className="text-[12px] font-semibold text-[#7c8091]">{label}</p>
    </div>
  );
}

export default function DashboardClient({ kpi, orders, stocks, transfers }: Props) {
  // Generate mock sparkline data from real data
  const sparkData = useMemo(() => ({
    orders: orders.slice(-8).map((_, i) => Math.max(1, Math.floor(Math.random() * 5 + 1 + i * 0.3))),
    items: Array.from({ length: 8 }, (_, i) => Math.max(1, Math.floor(kpi.totalItems * (0.1 + i * 0.12)))),
    stock: Array.from({ length: 8 }, (_, i) => Math.max(1, Math.floor(kpi.totalStock * (0.05 + i * 0.13)))),
    transfers: Array.from({ length: 8 }, (_, i) => Math.floor(Math.random() * 3 + i * 0.2)),
  }), [kpi, orders]);

  const yieldPct = kpi.totalItems > 0 ? Math.round((kpi.readyItems / kpi.totalItems) * 100) : 0;
  const activeOrderList = orders.filter((o) => !["RELEASED", "CANCELLED"].includes(o.status)).slice(0, 6);
  const recentTransfers = transfers.slice(0, 4);

  return (
    <div className="stagger space-y-5">
      {/* ── Row 1: 4 KPI Cards ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Active Orders */}
        <div className="card p-5">
          <div className="flex items-start justify-between">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#c24a08]/10 text-[#c24a08]">
              <Package size={20} />
            </span>
            <SparkBars data={sparkData.orders} color="bg-[#c24a08]" />
          </div>
          <p className="mt-4 text-3xl font-black tracking-tight text-[#1a1d23]">{kpi.activeOrders}</p>
          <p className="mt-0.5 text-[12px] font-medium text-[#7c8091]">Active orders</p>
        </div>

        {/* Items in Production */}
        <div className="card p-5">
          <div className="flex items-start justify-between">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#4a7c59]/10 text-[#4a7c59]">
              <CheckCircle2 size={20} />
            </span>
            <SparkBars data={sparkData.items} color="bg-[#4a7c59]" />
          </div>
          <p className="mt-4 text-3xl font-black tracking-tight text-[#1a1d23]">{kpi.readyItems}/{kpi.totalItems}</p>
          <p className="mt-0.5 text-[12px] font-medium text-[#7c8091]">Items completed</p>
        </div>

        {/* Stock Health */}
        <div className="card p-5">
          <div className="flex items-start justify-between">
            <span className={cn("grid h-11 w-11 place-items-center rounded-2xl", kpi.lowStock > 0 ? "bg-red-50 text-red-500" : "bg-[#4a7c59]/10 text-[#4a7c59]")}>
              {kpi.lowStock > 0 ? <AlertTriangle size={20} /> : <Warehouse size={20} />}
            </span>
            <SparkBars data={sparkData.stock} color={kpi.lowStock > 0 ? "bg-red-400" : "bg-[#4a7c59]"} />
          </div>
          <p className="mt-4 text-3xl font-black tracking-tight text-[#1a1d23]">{kpi.totalStock}</p>
          <p className="mt-0.5 text-[12px] font-medium text-[#7c8091]">{kpi.lowStock > 0 ? `${kpi.lowStock} low stock alerts` : "Stock healthy"}</p>
        </div>

        {/* Pending MOBILIX — dark accent card like the screenshot's Activity card */}
        <div className="card p-5 bg-[#1a1d23] text-white border-[#1a1d23]">
          <div className="flex items-start justify-between">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-white">
              <Truck size={20} />
            </span>
            <MiniLineChart data={sparkData.transfers} color="#6fa67d" />
          </div>
          <p className="mt-4 text-3xl font-black tracking-tight">{kpi.pendingSemi}</p>
          <p className="mt-0.5 text-[12px] font-medium text-white/60">Pending MOBILIX</p>
        </div>
      </div>

      {/* ── Row 2: Production Pipeline + Yield Gauge ── */}
      <div className="grid gap-5 lg:grid-cols-5">
        {/* Production Pipeline — Balance card */}
        <GlassCard className="lg:col-span-3">
          <SectionTitle kicker="Production" title="Order pipeline" hint="Recent orders and their progress through the factory." />
          {activeOrderList.length === 0 ? (
            <Empty icon="📦" title="No active orders" hint="Create a production order to see the pipeline." />
          ) : (
            <div className="space-y-3">
              {activeOrderList.map((o: any) => {
                const items = o.work_order_items ?? [];
                const done = items.filter((i: any) => i.status === "SEMI_READY" || i.status === "RELEASED").length;
                const pct = items.length > 0 ? Math.round((done / items.length) * 100) : 0;
                return (
                  <Link key={o.id} href={`/admin/orders/${o.id}`}
                    className="group flex items-center gap-4 rounded-2xl border border-black/5 bg-[#f8f7f5] p-4 hover:border-[#4a7c59]/20 hover:bg-white transition-all">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#1a1d23]">{o.order_number}</span>
                        <StatusPill status={o.status} />
                      </div>
                      <p className="mt-0.5 text-[12px] text-[#7c8091]">{items.length} items · {new Date(o.created_at).toLocaleDateString("fr-FR")}</p>
                    </div>
                    {/* Progress bar */}
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-2 rounded-full bg-black/5 overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all duration-500", pct === 100 ? "bg-[#4a7c59]" : "bg-[#2f6eb5]")} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[12px] font-bold text-[#7c8091] w-10 text-right">{pct}%</span>
                      <ArrowRight size={14} className="text-[#7c8091] group-hover:text-[#4a7c59] transition-colors" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </GlassCard>

        {/* Yield Performance — Earnings card */}
        <GlassCard className="lg:col-span-2">
          <SectionTitle kicker="Performance" title="Yield overview" />
          <div className="flex flex-col items-center gap-6 pt-2">
            <DonutGauge pct={yieldPct} color="#4a7c59" label="Completion rate" />
            <div className="w-full space-y-3">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-[#7c8091]">Steps overdue</span>
                <span className={cn("font-bold", kpi.overdueSteps > 0 ? "text-red-500" : "text-[#4a7c59]")}>{kpi.overdueSteps}</span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-[#7c8091]">Transfers to MOBILIX</span>
                <span className="font-bold text-[#2f6eb5]">{kpi.transfers}</span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-[#7c8091]">Pending semi-finished</span>
                <span className="font-bold text-[#c24a08]">{kpi.pendingSemi}</span>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* ── Row 3: Stock overview + Transfers ── */}
      <div className="grid gap-5 lg:grid-cols-5">
        {/* Stock Health */}
        <GlassCard className="lg:col-span-3">
          <SectionTitle kicker="Stocks" title="Materials overview" hint="Stock health at a glance."
            right={<Link href="/admin/stocks" className="btn-outline text-[12px] px-3 py-1.5 inline-flex items-center gap-1">View all <ArrowUpRight size={12} /></Link>} />
          {stocks.length === 0 ? (
            <Empty icon="📦" title="No stock items" hint="Materials will appear here after setup." />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {stocks.slice(0, 8).map((s: any) => {
                const pct = s.alert_threshold > 0 ? Math.min(100, Math.round((s.quantity / (s.alert_threshold * 3)) * 100)) : 50;
                return (
                  <div key={s.id} className="flex items-center gap-3 rounded-xl border border-black/5 bg-[#f8f7f5] p-3">
                    <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", s.low_stock ? "bg-red-400" : "bg-[#4a7c59]")} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-[#1a1d23]">{s.name}</p>
                      <div className="mt-1 h-1.5 rounded-full bg-black/5 overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", s.low_stock ? "bg-red-400" : "bg-[#4a7c59]")} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <span className="text-[12px] font-bold text-[#7c8091] shrink-0">{s.quantity} <span className="font-normal">{s.unit}</span></span>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>

        {/* Recent Transfers */}
        <GlassCard className="lg:col-span-2">
          <SectionTitle kicker="Logistics" title="Recent transfers"
            right={<Link href="/admin/incidents" className="text-[12px] font-semibold text-[#4a7c59] hover:underline">View all</Link>} />
          {recentTransfers.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <div className="text-3xl">🚚</div>
              <p className="text-[13px] font-semibold text-[#1a1d23]">No transfers yet</p>
              <p className="text-[12px] text-[#7c8091]">Release items to send to MOBILIX.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentTransfers.map((t: any) => (
                <div key={t.id} className="flex items-center gap-3 rounded-xl border border-black/5 bg-[#f8f7f5] p-3">
                  <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[13px] font-bold",
                    t.status === "VERIFIED" ? "bg-[#4a7c59]/10 text-[#4a7c59]" : "bg-amber-50 text-amber-600")}>
                    {t.status === "VERIFIED" ? "✓" : "⏳"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-[#1a1d23] truncate">{t.manifest_qr}</p>
                    <p className="text-[11px] text-[#7c8091]">{t.item_count} items · {new Date(t.created_at).toLocaleDateString("fr-FR")}</p>
                  </div>
                  <StatusPill status={t.status} />
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
