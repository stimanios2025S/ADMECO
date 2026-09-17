"use client";
import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { Package, CheckCircle2, AlertTriangle, Warehouse, ArrowRight, Clock, Bell, Truck, Boxes, ArrowLeftRight } from "lucide-react";
import { GlassCard, SectionTitle, StatusPill, Empty } from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import { statutFr } from "@/lib/fr";

type Props = {
  usine: string;
  kpi: { activeOrders: number; totalItems: number; readyItems: number; lowStock: number; pendingSemi: number; overdueSteps: number; transfers: number; totalStock: number; alertes: number; reservations: number };
  orders: any[]; stocks: any[]; transfers: any[]; alertes: any[]; reservations: any[];
};

// ── Production Timer ──
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
            {running ? "⏸" : "▶"}
          </button>
          <button onClick={() => { setRunning(false); setElapsed(0); }}
            className="grid h-9 w-9 place-items-center rounded-xl bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors">
            ⏹
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Weekly Activity Chart ──
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
              v === max ? "bg-gradient-to-t from-[#3a6b48] to-[#4a7c59]" : "bg-[#4a7c59]/25"
            )} style={{ opacity: v === max ? 1 : 0.4 + (v / max) * 0.6 }} />
          </div>
          <span className="text-[11px] font-semibold text-[#9ca3af]">{days[i]}</span>
        </div>
      ))}
    </div>
  );
}

// ── Circular Progress ──
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

export default function DashboardClient({ usine, kpi, orders, stocks, transfers, alertes, reservations }: Props) {
  const isMobilix = usine === "MOBILIX";
  const accent = isMobilix ? "#7c3aed" : "#4a7c59";
  const yieldPct = kpi.totalItems > 0 ? Math.round((kpi.readyItems / kpi.totalItems) * 100) : 0;
  const activeOrderList = orders.filter((o) => !["RELEASED", "CANCELLED"].includes(o.status)).slice(0, 5);
  const recentTransfers = transfers.slice(0, 4);
  const mpDepot = isMobilix ? "DEP-MP-MBX" : "DEP-MP";
  const mpStocks = stocks.filter((s) => (s.depot_code ?? mpDepot) === mpDepot).slice(0, 5);

  const weeklyData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const dayOrders = orders.filter((o) => {
        if (!o.created_at) return false;
        const d = new Date(o.created_at);
        return d.getDay() === ((i + 1) % 7);
      });
      return dayOrders.length;
    });
  }, [orders]);

  // Réserves agrégées par matière : réservé vs consommé
  const reservesParMatiere = useMemo(() => {
    const map = new Map<string, { material: string; unit: string; reserve: number; consomme: number; emprunts: number }>();
    for (const r of reservations ?? []) {
      const name = r.stock_items?.name ?? "Matière";
      const unit = r.stock_items?.unit ?? "pcs";
      const prev = map.get(name) ?? { material: name, unit, reserve: 0, consomme: 0, emprunts: 0 };
      prev.reserve += Number(r.estimated_qty ?? 0);
      prev.consomme += Number(r.consumed_qty ?? 0);
      map.set(name, prev);
    }
    return Array.from(map.values()).slice(0, 6);
  }, [reservations]);

  return (
    <div className="stagger space-y-5">
      {/* Bandeau usine */}
      <div className={cn("flex items-center gap-3 rounded-2xl border p-4",
        isMobilix ? "border-[#7c3aed]/20 bg-[#7c3aed]/[0.05]" : "border-[#4a7c59]/20 bg-[#4a7c59]/[0.05]")}>
        <span className={cn("grid h-11 w-11 place-items-center rounded-xl text-white text-lg font-black",
          isMobilix ? "bg-[#7c3aed]" : "bg-[#4a7c59]")}>{isMobilix ? "M" : "A"}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-extrabold text-[#1a1d23]">Usine {isMobilix ? "MOBILIX" : "ADMEDCO"}</p>
          <p className="text-[12px] text-[#7c8091]">Vue scopée — seules les données de cette usine sont affichées.</p>
        </div>
        {alertes.length > 0 && (
          <Link href="/admin/incidents" className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-red-500 px-3 py-2 text-[12px] font-bold text-white">
            <Bell size={14} /> {alertes.length} alerte(s)
          </Link>
        )}
      </div>

      {/* ── Row 1: 4 KPI Cards ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className={cn("relative overflow-hidden rounded-2xl p-5 text-white shadow-lg",
          isMobilix ? "bg-gradient-to-br from-[#7c3aed] to-[#5b21b6] shadow-[#7c3aed]/15" : "bg-gradient-to-br from-[#4a7c59] to-[#3a6b48] shadow-[#4a7c59]/15")}>
          <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-white/[0.06]" />
          <div className="relative z-10">
            <div className="flex items-start justify-between">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15"><Package size={18} /></span>
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold">{usine}</span>
            </div>
            <p className="mt-4 text-[32px] font-black leading-none tracking-tight">{kpi.activeOrders}</p>
            <p className="mt-1 text-[12px] font-medium text-white/70">Commandes actives</p>
          </div>
        </div>

        <div className="rounded-2xl border border-black/[0.04] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#4a7c59]/10 text-[#4a7c59]"><Warehouse size={18} /></span>
            <span className="rounded-full bg-[#4a7c59]/10 px-2 py-0.5 text-[10px] font-bold text-[#4a7c59]">{kpi.totalStock} réf.</span>
          </div>
          <p className="mt-4 text-[32px] font-black leading-none tracking-tight text-[#1a1d23]">{kpi.reservations}</p>
          <p className="mt-1 text-[12px] font-medium text-[#9ca3af]">Réserves actives</p>
        </div>

        <div className="rounded-2xl border border-black/[0.04] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <span className={cn("grid h-10 w-10 place-items-center rounded-xl", kpi.lowStock > 0 ? "bg-red-50 text-red-500" : "bg-[#4a7c59]/10 text-[#4a7c59]")}>
              {kpi.lowStock > 0 ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            </span>
          </div>
          <p className="mt-4 text-[32px] font-black leading-none tracking-tight text-[#1a1d23]">{kpi.lowStock}</p>
          <p className="mt-1 text-[12px] font-medium text-[#9ca3af]">{kpi.lowStock > 0 ? "Stock bas MP" : "Stock sain"}</p>
        </div>

        <div className="rounded-2xl border border-black/[0.04] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <span className={cn("grid h-10 w-10 place-items-center rounded-xl", kpi.alertes > 0 ? "bg-red-50 text-red-500" : "bg-[#4a7c59]/10 text-[#4a7c59]")}>
              <Bell size={18} />
            </span>
          </div>
          <p className="mt-4 text-[32px] font-black leading-none tracking-tight text-[#1a1d23]">{kpi.alertes}</p>
          <p className="mt-1 text-[12px] font-medium text-[#9ca3af]">Alertes non lues</p>
        </div>
      </div>

      {/* ── Réserves & emprunts + Destinations en attente ── */}
      <div className="grid gap-5 lg:grid-cols-5">
        <GlassCard className="lg:col-span-3">
          <SectionTitle kicker="Matières" title="Réserves & emprunts"
            hint="Réservé vs consommé par matière (commandes de l'usine)."
            right={<Link href="/admin/stocks" className="text-[12px] font-semibold hover:underline" style={{ color: accent }}>Stocks →</Link>} />
          {reservesParMatiere.length === 0 ? (
            <Empty icon="📦" title="Aucune réserve active" hint="Les réserves MP apparaîtront à la création des commandes." />
          ) : (
            <div className="space-y-2.5">
              {reservesParMatiere.map((r) => {
                const pct = r.reserve > 0 ? Math.min(100, Math.round((r.consomme / r.reserve) * 100)) : 0;
                const reste = Math.max(0, +(r.reserve - r.consomme).toFixed(2));
                return (
                  <div key={r.material} className="rounded-xl border border-black/[0.04] bg-[#fafbf9] p-3">
                    <div className="flex items-center gap-2">
                      <Boxes size={14} className="text-[#7c8091]" />
                      <p className="min-w-0 flex-1 truncate text-[13px] font-bold text-[#1a1d23]">{r.material}</p>
                      {r.emprunts > 0 && (
                        <span className="rounded-full bg-[#c24a08]/10 px-2 py-0.5 text-[10px] font-black text-[#c24a08]">EMPRUNT</span>
                      )}
                      <span className="text-[11px] font-bold text-[#7c8091]">{r.consomme}/{r.reserve} {r.unit}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/[0.05]">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: accent }} />
                    </div>
                    <p className="mt-1 text-[11px] text-[#9ca3af]">Reste à consommer : <b className="text-[#1a1d23]">{reste} {r.unit}</b> · {pct}% consommé</p>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>

        <GlassCard className="lg:col-span-2">
          <SectionTitle kicker="Logistique" title="Destinations en attente"
            hint="Lots semi-finis sans décision."
            right={<Link href="/admin/destinations" className="text-[12px] font-semibold hover:underline" style={{ color: accent }}>Décider →</Link>} />
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-center">
            <Truck size={22} className="mx-auto text-amber-600" />
            <p className="mt-2 text-[26px] font-black text-[#1a1d23]">{kpi.pendingSemi}</p>
            <p className="text-[12px] font-medium text-[#7c8091]">lot(s) en attente de décision</p>
            <Link href="/admin/destinations"
              className={cn("mt-3 inline-flex items-center gap-1 rounded-xl px-4 py-2 text-[12px] font-bold text-white",
                isMobilix ? "bg-[#7c3aed] hover:bg-[#6d28d9]" : "bg-[#4a7c59] hover:bg-[#3a6b48]")}>
              Ouvrir les destinations <ArrowRight size={13} />
            </Link>
          </div>
          <div className="mt-3 space-y-1.5 text-[12px]">
            <div className="flex items-center justify-between">
              <span className="text-[#9ca3af]">Transferts ({usine})</span>
              <span className="font-bold" style={{ color: accent }}>{kpi.transfers}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#9ca3af]">Articles suivis</span>
              <span className="font-bold text-[#1a1d23]">{kpi.totalItems}</span>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* ── Row 2: Activity Chart + Rappels + Commandes ── */}
      <div className="grid gap-5 lg:grid-cols-5">
        <GlassCard className="lg:col-span-2">
          <SectionTitle kicker="Production" title="Activité de la semaine" />
          <WeeklyActivity data={weeklyData} />
          <div className="mt-4 flex items-center gap-4 text-[11px] font-semibold text-[#9ca3af]">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-md" style={{ backgroundColor: accent }} /> Production
            </span>
            <span>{kpi.activeOrders} commandes actives ({usine})</span>
          </div>
        </GlassCard>

        <GlassCard className="lg:col-span-1">
          <SectionTitle kicker="Alertes" title="Rappels" />
          <div className="space-y-3">
            {alertes.slice(0, 3).map((a: any) => (
              <div key={a.id} className="rounded-xl border border-red-200 bg-red-50/50 p-3">
                <p className="text-[13px] font-bold text-red-600">{a.type ?? "Alerte"}</p>
                <p className="text-[11px] text-[#9ca3af] mt-0.5 line-clamp-2">{a.message}</p>
              </div>
            ))}
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
                <p className="text-[13px] font-bold text-amber-700">Destination à décider</p>
                <p className="text-[11px] text-[#9ca3af] mt-0.5">{kpi.pendingSemi} lot(s) en attente</p>
                <Link href="/admin/destinations" className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:underline">
                  Décider <ArrowRight size={11} />
                </Link>
              </div>
            )}
            {alertes.length === 0 && kpi.lowStock === 0 && kpi.pendingSemi === 0 && (
              <div className="rounded-xl border border-[#4a7c59]/20 bg-[#4a7c59]/[0.04] p-3">
                <p className="text-[13px] font-bold text-[#4a7c59]">✅ Tout est en ordre</p>
                <p className="text-[11px] text-[#9ca3af] mt-0.5">Aucune alerte active</p>
              </div>
            )}
            {(alertes.length > 3 || kpi.alertes > 0) && (
              <Link href="/admin/incidents" className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 hover:underline">
                <Bell size={11} /> Toutes les alertes ({kpi.alertes})
              </Link>
            )}
          </div>
        </GlassCard>

        <GlassCard className="lg:col-span-2">
          <SectionTitle kicker="Production" title="Commandes récentes"
            right={<Link href="/admin/orders/new" className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-white transition-colors"
              style={{ backgroundColor: accent }}>+ Nouveau</Link>} />
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
                    className="group flex items-center gap-3 rounded-xl border border-black/[0.04] bg-[#fafbf9] p-3 hover:bg-white transition-all">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-[#1a1d23]">{o.order_number}</span>
                        <StatusPill status={o.status} />
                      </div>
                      <p className="text-[11px] text-[#9ca3af] mt-0.5">{items.length} articles · {o.created_at ? new Date(o.created_at).toLocaleDateString("fr-FR") : "—"}</p>
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

      {/* ── Row 3: Stocks + Transferts + Timer ── */}
      <div className="grid gap-5 lg:grid-cols-5">
        <GlassCard className="lg:col-span-2">
          <SectionTitle kicker="Stocks" title={`Matières — ${mpDepot}`}
            right={<Link href="/admin/stocks" className="text-[12px] font-semibold hover:underline" style={{ color: accent }}>Tout voir</Link>} />
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

        <GlassCard className="lg:col-span-2">
          <SectionTitle kicker="Logistique" title="Transferts récents"
            right={<Link href="/admin/destinations" className="text-[12px] font-semibold hover:underline" style={{ color: accent }}>Destinations</Link>} />
          {recentTransfers.length === 0 ? (
            <Empty icon="🚚" title="Aucun transfert" hint="Les transferts MOBILIX apparaîtront ici." />
          ) : (
            <div className="space-y-2">
              {recentTransfers.map((t: any) => (
                <div key={t.id} className="flex items-center gap-3 rounded-xl border border-black/[0.04] bg-[#fafbf9] p-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#7c3aed]/10 text-[#7c3aed]">
                    <ArrowLeftRight size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[13px] font-bold text-[#1a1d23]">{t.manifest_qr ?? t.id?.slice(0, 8)}</p>
                    <p className="text-[11px] text-[#9ca3af]">{t.destination ?? "—"} · {t.created_at ? new Date(t.created_at).toLocaleDateString("fr-FR") : "—"}</p>
                  </div>
                  <StatusPill status={t.status ?? "PENDING"} />
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        <div className="lg:col-span-1 space-y-4">
          <ProductionTimer />
          <div className="rounded-2xl border border-black/[0.04] bg-white p-5 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#9ca3af] mb-3">Progression</p>
            <CircularProgress pct={yieldPct} color={accent} label="Taux d'achèvement" />
            <div className="mt-3 space-y-1.5 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="text-[#9ca3af] flex items-center gap-1"><Clock size={12} /> Transferts</span>
                <span className="font-bold" style={{ color: accent }}>{kpi.transfers}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#9ca3af]">En attente</span>
                <span className="font-bold text-[#c24a08]">{kpi.pendingSemi}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#9ca3af]">Alertes</span>
                <span className="font-bold text-red-500">{kpi.alertes}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
