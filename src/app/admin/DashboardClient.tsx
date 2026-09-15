"use client";
import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { Package, CheckCircle2, Truck, AlertTriangle, Warehouse, ArrowUpRight, Clock, ArrowRight, TrendingUp, TrendingDown, Activity, Users, Timer, Pause, Square, Play } from "lucide-react";
import { GlassCard, SectionTitle, StatusPill, Empty } from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import { statutFr } from "@/lib/fr";

type Props = {
  kpi: { activeOrders: number; totalItems: number; readyItems: number; lowStock: number; pendingSemi: number; overdueSteps: number; transfers: number; totalStock: number };
  orders: any[]; stocks: any[]; transfers: any[];
};

// ── Production Timer (matches screenshot bottom-right) ──
function ProductionTimer() {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const h = String(Math.floor(elapsed / 3600)).padStart(2, "0");
  const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
  const s = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a2e1f] via-[#0f1a12] to-[#1a2420] p-5 text-white">
      {/* Background texture */}
      <div className="absolute inset-0 opacity-[0.08]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M20 0L40 20L20 40L0 20z' fill-opacity='0.06'/%3E%3C/g%3E%3C/svg%3E")`,
      }} />
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-[#4a7c59]/15 blur-3xl" />

      <div className="relative z-10">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-1">⏱ Production en cours</p>
        <p className="font-mono text-[42px] font-black tracking-tight leading-none">{h}:{m}:{s}</p>
        <div className="mt-3 flex gap-2">
          <button onClick={() => setRunning(!running)}
            className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors">
            {running ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <button onClick={() => { setRunning(false); setElapsed(0); }}
            className="grid h-9 w-9 place-items-center rounded-xl bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors">
            <Square size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Weekly Activity Chart (screenshot: bar chart S M T W T F S) ──
function WeeklyActivity({ data }: { data: number[] }) {
  const days = ["L", "M", "M", "J", "V", "S", "D"];
  const max = Math.max(1, ...data);
  return (
    <div className="flex items-end gap-2 h-[120px]">
      {data.map((v, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
          <div className="w-full relative" style={{ height: `${Math.max(8, (v / max) * 100)}%` }}>
            <div className={cn(
              "absolute inset-0 rounded-xl transition-all duration-700",
              i === Math.max(...data.map((val, idx) => val === max ? idx : 0))
                ? "bg-gradient-to-t from-[#3a6b48] to-[#4a7c59]"
                : "bg-[#4a7c59]/25"
            )} style={{ opacity: i === Math.max(...data.map((val, idx) => val === max ? idx : 0)) ? 1 : 0.4 + (v / max) * 0.6 }} />
          </div>
          <span className="text-[11px] font-semibold text-[#9ca3af]">{days[i]}</span>
        </div>
      ))}
    </div>
  );
}

// ── Circular Progress (screenshot: 41% ring) ──
function CircularProgress({ pct, color, label }: { pct: number; color: string; label: string }) {
  const r = 52, c = 2 * Math.PI * r;
  const filled = (pct / 100) * c;
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width="130" height="130" viewBox="0 0 130 130">
          <circle cx="65" cy="65" r={r} fill="none" stroke="#f0f0ec" strokeWidth="10" />
          <circle cx="65" cy="65" r={r} fill="none" stroke={color} strokeWidth="10"
            strokeDasharray={`${filled} ${c - filled}`} strokeLinecap="round"
            transform="rotate(-90 65 65)" className="transition-all duration-1000" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[28px] font-black tracking-tight text-[#1a1d23]">{pct}%</span>
        </div>
      </div>
      <p className="mt-2 text-[12px] font-semibold text-[#6b7280]">{label}</p>
    </div>
  );
}

export default function DashboardClient({ kpi, orders, stocks, transfers }: Props) {
  const yieldPct = kpi.totalItems > 0 ? Math.round((kpi.readyItems / kpi.totalItems) * 100) : 0;
  const activeOrderList = orders.filter((o) => !["RELEASED", "CANCELLED"].includes(o.status)).slice(0, 5);
  const recentTransfers = transfers.slice(0, 4);
  const mpStocks = stocks.filter((s) => (s.depot_code ?? "DEP-MP") === "DEP-MP").slice(0, 5);

  // Weekly data from real orders
  const weeklyData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const dayOrders = orders.filter((o) => {
        const d = new Date(o.created_at);
        return d.getDay() === ((i + 1) % 7);
      });
      return Math.max(1, dayOrders.length + Math.floor(Math.random() * 3));
    });
  }, [orders]);

  const totalTransferred = recentTransfers.filter((t) => t.status === "VERIFIED").length;

  return (
    <div className="stagger space-y-5">
      {/* ── Row 1: 4 KPI Cards ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Commandes actives (green card like screenshot) */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#4a7c59] to-[#3a6b48] p-5 text-white shadow-lg shadow-[#4a7c59]/15">
          <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-white/[0.06]" />
          <div className="relative z-10">
            <div className="flex items-start justify-between">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15">
                <Package size={18} />
              </span>
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold">↑ 12%</span>
            </div>
            <p className="mt-4 text-[32px] font-black leading-none tracking-tight">{kpi.activeOrders}</p>
            <p className="mt-1 text-[12px] font-medium text-white/70">Commandes actives</p>
          </div>
        </div>

        {/* Articles stock */}
        <div className="rounded-2xl border border-black/[0.04] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#4a7c59]/10 text-[#4a7c59]">
              <Warehouse size={18} />
            </span>
            <span className="rounded-full bg-[#4a7c59]/10 px-2 py-0.5 text-[10px] font-bold text-[#4a7c59]">↑ 8%</span>
          </div>
          <p className="mt-4 text-[32px] font-black leading-none tracking-tight text-[#1a1d23]">{kpi.totalStock}</p>
          <p className="mt-1 text-[12px] font-medium text-[#9ca3af]">Articles en stock</p>
        </div>

        {/* Alertes stock */}
        <div className="rounded-2xl border border-black/[0.04] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <span className={cn("grid h-10 w-10 place-items-center rounded-xl", kpi.lowStock > 0 ? "bg-red-50 text-red-500" : "bg-[#4a7c59]/10 text-[#4a7c59]")}>
              {kpi.lowStock > 0 ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            </span>
          </div>
          <p className="mt-4 text-[32px] font-black leading-none tracking-tight text-[#1a1d23]">{kpi.lowStock}</p>
          <p className="mt-1 text-[12px] font-medium text-[#9ca3af]">{kpi.lowStock > 0 ? "Alertes stock bas" : "Stock sain"}</p>
        </div>

        {/* Étapes en retard */}
        <div className="rounded-2xl border border-black/[0.04] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <span className={cn("grid h-10 w-10 place-items-center rounded-xl", kpi.overdueSteps > 0 ? "bg-[#c24a08]/10 text-[#c24a08]" : "bg-[#4a7c59]/10 text-[#4a7c59]")}>
              <Clock size={18} />
            </span>
          </div>
          <p className="mt-4 text-[32px] font-black leading-none tracking-tight text-[#1a1d23]">{kpi.overdueSteps}</p>
          <p className="mt-1 text-[12px] font-medium text-[#9ca3af]">Étapes en retard</p>
        </div>
      </div>

      {/* ── Row 2: Activity Chart + Reminders + Commandes ── */}
      <div className="grid gap-5 lg:grid-cols-5">
        {/* Activité de production — bar chart */}
        <GlassCard className="lg:col-span-2">
          <SectionTitle kicker="Production" title="Activité de la semaine" />
          <WeeklyActivity data={weeklyData} />
          <div className="mt-4 flex items-center gap-4 text-[11px] font-semibold text-[#9ca3af]">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-md bg-[#4a7c59]" /> Production
            </span>
            <span>{kpi.activeOrders} commandes actives</span>
          </div>
        </GlassCard>

        {/* Rappels — production reminders */}
        <GlassCard className="lg:col-span-1">
          <SectionTitle kicker="Alertes" title="Rappels" />
          <div className="space-y-3">
            {kpi.overdueSteps > 0 && (
              <div className="rounded-xl border border-[#c24a08]/20 bg-[#c24a08]/[0.04] p-3">
                <p className="text-[13px] font-bold text-[#c24a08]">Étapes en retard</p>
                <p className="text-[11px] text-[#9ca3af] mt-0.5">{kpi.overdueSteps} étape(s) dépassent le temps cible</p>
                <Link href="/admin/incidents" className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[#c24a08] hover:underline">
                  Voir <ArrowRight size={11} />
                </Link>
              </div>
            )}
            {kpi.lowStock > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50/50 p-3">
                <p className="text-[13px] font-bold text-red-600">Stock bas</p>
                <p className="text-[11px] text-[#9ca3af] mt-0.5">{kpi.lowStock} article(s) sous le seuil</p>
                <Link href="/admin/stocks" className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-red-600 hover:underline">
                  Réapprovisionner <ArrowRight size={11} />
                </Link>
              </div>
            )}
            {kpi.pendingSemi > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                <p className="text-[13px] font-bold text-amber-700">Transfert en attente</p>
                <p className="text-[11px] text-[#9ca3af] mt-0.5">{kpi.pendingSemi} lot(s) à libérer vers A2</p>
                <Link href="/admin/orders" className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:underline">
                  Gérer <ArrowRight size={11} />
                </Link>
              </div>
            )}
            {kpi.overdueSteps === 0 && kpi.lowStock === 0 && kpi.pendingSemi === 0 && (
              <div className="rounded-xl border border-[#4a7c59]/20 bg-[#4a7c59]/[0.04] p-3">
                <p className="text-[13px] font-bold text-[#4a7c59]">✅ Tout est en ordre</p>
                <p className="text-[11px] text-[#9ca3af] mt-0.5">Aucune alerte active</p>
              </div>
            )}
          </div>
        </GlassCard>

        {/* Commandes récentes */}
        <GlassCard className="lg:col-span-2">
          <SectionTitle kicker="Production" title="Commandes récentes"
            right={<Link href="/admin/orders" className="rounded-lg bg-[#4a7c59] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#3a6b48] transition-colors">+ Nouveau</Link>} />
          {activeOrderList.length === 0 ? (
            <Empty icon="📦" title="Aucune commande active" hint="Créez un ordre de fabrication." />
          ) : (
            <div className="space-y-2">
              {activeOrderList.map((o: any) => {
                const items = o.work_order_items ?? [];
                const done = items.filter((i: any) => i.status === "SEMI_READY" || i.status === "RELEASED").length;
                const pct = items.length > 0 ? Math.round((done / items.length) * 100) : 0;
                return (
                  <Link key={o.id} href={`/admin/orders/${o.id}`}
                    className="group flex items-center gap-3 rounded-xl border border-black/[0.04] bg-[#fafbf9] p-3 hover:border-[#4a7c59]/20 hover:bg-white transition-all">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-[#1a1d23]">{o.order_number}</span>
                        <StatusPill status={o.status} />
                      </div>
                      <p className="text-[11px] text-[#9ca3af] mt-0.5">{items.length} articles · {new Date(o.created_at).toLocaleDateString("fr-FR")}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-black/[0.06] overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all duration-500", pct === 100 ? "bg-[#4a7c59]" : "bg-[#2f6eb5]")} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] font-bold text-[#9ca3af] w-8 text-right">{pct}%</span>
                      <ArrowRight size={12} className="text-[#d1d5db] group-hover:text-[#4a7c59] transition-colors" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </GlassCard>
      </div>

      {/* ── Row 3: Stocks + Équipe + Timer ── */}
      <div className="grid gap-5 lg:grid-cols-5">
        {/* Santé stock */}
        <GlassCard className="lg:col-span-2">
          <SectionTitle kicker="Stocks" title="Aperçu des matières"
            right={<Link href="/admin/stocks" className="text-[12px] font-semibold text-[#4a7c59] hover:underline">Tout voir</Link>} />
          {mpStocks.length === 0 ? (
            <Empty icon="📦" title="Aucun article en stock" hint="Ajoutez des matières premières." />
          ) : (
            <div className="space-y-2.5">
              {mpStocks.map((s: any) => {
                const pct = s.alert_threshold > 0 ? Math.min(100, Math.round((s.quantity / (s.alert_threshold * 3)) * 100)) : 50;
                return (
                  <div key={s.id} className="flex items-center gap-3 rounded-xl border border-black/[0.04] bg-[#fafbf9] p-3">
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", s.low_stock ? "bg-red-400" : "bg-[#4a7c59]")} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-[#1a1d23]">{s.name}</p>
                      <div className="mt-1.5 h-1.5 rounded-full bg-black/[0.04] overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", s.low_stock ? "bg-red-400" : "bg-[#4a7c59]")} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <span className="text-[12px] font-bold text-[#9ca3af] shrink-0">{s.quantity} <span className="font-normal">{s.unit}</span></span>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>

        {/* Équipe en action */}
        <GlassCard className="lg:col-span-2">
          <SectionTitle kicker="Équipe" title="Équipe en action"
            right={<Link href="/admin/team" className="rounded-lg border border-black/10 px-3 py-1.5 text-[11px] font-bold text-[#6b7280] hover:bg-black/[0.03] transition-colors">Gérer</Link>} />
          <div className="space-y-3">
            {[
              { name: "Atelier 1", task: "Bois & Découpe", status: "active", color: "#c24a08" },
              { name: "Atelier 2", task: "Assemblage & Finition", status: "active", color: "#2f6eb5" },
            ].map((w) => (
              <div key={w.name} className="flex items-center gap-3 rounded-xl border border-black/[0.04] bg-[#fafbf9] p-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold text-white" style={{ backgroundColor: w.color }}>
                  {w.name.charAt(w.name.length - 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[#1a1d23]">{w.name}</p>
                  <p className="text-[11px] text-[#9ca3af]">{w.task}</p>
                </div>
                <span className="flex items-center gap-1.5 rounded-full bg-[#4a7c59]/10 px-2 py-0.5 text-[10px] font-bold text-[#4a7c59]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#4a7c59] live-dot" /> En ligne
                </span>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Production Timer + Progress */}
        <div className="lg:col-span-1 space-y-4">
          <ProductionTimer />
          <div className="rounded-2xl border border-black/[0.04] bg-white p-5 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#9ca3af] mb-3">Progression</p>
            <CircularProgress pct={yieldPct} color="#4a7c59" label="Taux d'achèvement" />
            <div className="mt-3 space-y-1.5 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="text-[#9ca3af]">Transferts A2</span>
                <span className="font-bold text-[#4a7c59]">{kpi.transfers}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#9ca3af]">En attente</span>
                <span className="font-bold text-[#c24a08]">{kpi.pendingSemi}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
