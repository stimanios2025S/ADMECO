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
        <Stat label="Incidents ouverts" value={String(total)} sub="Toute la plateforme" accent={total > 0 ? "red" : "green"} />
        <Stat label="Étapes en retard" value={String(liveOverdue.length)} sub="Temps cible dépassé" accent="fire" />
        <Stat label="Stock bas" value={String(lowStock.length)} sub="Sous le seuil" accent={lowStock.length > 0 ? "red" : "green"} />
        <Stat label="Transferts" value={String(transfers.length)} sub="Vers l'Atelier 2" accent="ice" />
      </div>

      {/* En retard */}
      <GlassCard>
        <SectionTitle kicker="Temps" title="Étapes en retard" hint="Étapes ayant dépassé leur temps estimé." />
        {liveOverdue.length === 0 ? <Empty icon="⏱️" title="Aucun retard" hint="Toutes les étapes sont dans les temps." /> : (
          <div className="grid gap-2.5 md:grid-cols-2">
            {liveOverdue.map((s: any) => (
              <div key={s.id} className="card flex items-center gap-3 p-3.5">
                <span className="text-2xl">🔴</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">#{s.step_order} {s.step_name}</p>
                  <p className="text-xs text-[#7c8091]">Réel {Number(s.actual_minutes).toFixed(0)} min / cible {s.estimated_minutes} min</p>
                </div>
                <span className="rounded-lg bg-red-50 border border-red-200 px-2 py-1 text-xs font-black text-red-500">
                  +{Number(s.variance_min).toFixed(0)}m
                </span>
                <button onClick={() => setDismissed((d) => [...d, s.id])} className="text-xs font-bold text-emerald-600 hover:underline" title="Acknowledge">
                  <CheckCheck size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Stock bas */}
      <GlassCard>
        <SectionTitle kicker="Stock" title="Alertes stock bas" hint="Matières sous leur seuil d'alerte." />
        {lowStock.length === 0 ? <Empty icon="✅" title="Stock sain" hint="Toutes les matières sont au-dessus du seuil." /> : (
          <div className="grid gap-2.5 md:grid-cols-2">
            {lowStock.map((s: any) => (
              <div key={s.id} className="card flex items-center gap-3 p-3.5">
                <span className="text-2xl">⚠️</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{s.name}</p>
                  <p className="text-xs text-[#7c8091]">{s.quantity} {s.unit} restants · seuil {s.alert_threshold}</p>
                </div>
                <Link href="/admin/stocks" className="text-xs font-bold text-[#2f6eb5] hover:underline">Réappro →</Link>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Transferts */}
      <GlassCard>
        <SectionTitle kicker="Logistique" title="Transferts vers l'Atelier 2" hint="Statut des bordereaux des produits libérés." />
        {transfers.length === 0 ? <Empty icon="🚚" title="Aucun transfert" hint="Libérez des articles depuis les commandes." /> : (
          <div className="space-y-2">
            {transfers.map((t: any) => (
              <div key={t.id} className="card flex items-center gap-3 p-3.5">
                <StatusPill status={t.status} />
                <span className="font-mono text-sm font-bold text-[#c24a08]">{t.manifest_qr}</span>
                <span className="text-xs text-[#7c8091]">{t.work_orders?.order_number} · {t.item_count} items</span>
                <span className="ml-auto text-xs text-[#7c8091]">{new Date(t.created_at).toLocaleString("fr-FR")}</span>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
