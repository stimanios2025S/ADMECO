"use client";
import { useState } from "react";
import Link from "next/link";
import { Bell, AlarmClock, Package, CheckCheck } from "lucide-react";
import { GlassCard, SectionTitle, Stat, StatusPill, Empty } from "@/components/admin/ui";
import { marquerAlerteLue } from "@/app/actions-usines";
import { cn } from "@/lib/utils";

type Props = { usine: string; alertes: any[]; lowStock: any[]; overdue: any[] };

export default function IncidentsClient({ usine, alertes, lowStock, overdue }: Props) {
  const [lues, setLues] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const actives = alertes.filter((a) => !a.lu && !lues.includes(a.id));
  const total = actives.length + lowStock.length + overdue.length;

  const marquerLue = async (id: string) => {
    setBusy(id);
    const r = await marquerAlerteLue(id);
    setBusy(null);
    if (r.ok) setLues((l) => [...l, id]);
    else setMsg(r.message);
  };

  return (
    <div className="stagger space-y-5">
      {msg && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[13px] font-semibold text-red-600">{msg}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Alertes ouvertes" value={String(total)} sub={`Usine ${usine}`} accent={total > 0 ? "red" : "green"} />
        <Stat label="Non lues" value={String(actives.length)} sub="Emprunts & messages" accent={actives.length > 0 ? "red" : "green"} />
        <Stat label="Stock bas" value={String(lowStock.length)} sub="Sous le seuil" accent={lowStock.length > 0 ? "red" : "green"} />
        <Stat label="Étapes en retard" value={String(overdue.length)} sub="Temps cible dépassé" accent="fire" />
      </div>

      {/* Alertes (table alertes) */}
      <GlassCard>
        <SectionTitle kicker="Messages" title="Alertes"
          hint="Emprunts inter-commandes et messages de l'usine."
          right={actives.length > 0
            ? <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2.5 py-1 text-[11px] font-black text-white"><Bell size={11} /> {actives.length} non lue(s)</span>
            : <span className="rounded-full bg-[#4a7c59]/10 px-2.5 py-1 text-[11px] font-black text-[#4a7c59]">Tout lu</span>} />
        {alertes.length === 0 ? (
          <Empty icon="🔔" title="Aucune alerte" hint="Les emprunts et messages apparaîtront ici." />
        ) : (
          <div className="space-y-2">
            {alertes.map((a: any) => {
              const lu = a.lu || lues.includes(a.id);
              return (
                <div key={a.id} className={cn("card flex items-start gap-3 p-3.5", !lu && "border-red-200 bg-red-50/30")}>
                  <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                    a.type === "EMPRUNT" ? "bg-[#c24a08]/10 text-[#c24a08]" : "bg-red-50 text-red-500")}>
                    {a.type === "EMPRUNT" ? "🔀" : <Bell size={16} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill status={lu ? "DONE" : "PENDING"} />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#7c8091]">{a.type ?? "Alerte"}</span>
                      <span className="text-[11px] text-[#9ca3af]">{a.created_at ? new Date(a.created_at).toLocaleString("fr-FR") : ""}</span>
                    </div>
                    <p className="mt-1 text-[13px] font-medium text-[#1a1d23]">{a.message}</p>
                  </div>
                  {!lu && (
                    <button disabled={busy === a.id} onClick={() => marquerLue(a.id)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-[#4a7c59]/25 bg-[#4a7c59]/10 px-3 py-1.5 text-[11px] font-bold text-[#4a7c59] hover:bg-[#4a7c59]/15">
                      <CheckCheck size={13} /> {busy === a.id ? "…" : "Marquer comme lu"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      {/* Stock bas */}
      <GlassCard>
        <SectionTitle kicker="Stock" title="Stock bas" hint={`Matières sous leur seuil — usine ${usine}.`} />
        {lowStock.length === 0 ? <Empty icon="✅" title="Stock sain" hint="Toutes les matières sont au-dessus du seuil." /> : (
          <div className="grid gap-2.5 md:grid-cols-2">
            {lowStock.map((s: any) => (
              <div key={s.id} className="card flex items-center gap-3 p-3.5">
                <span className="text-2xl">⚠️</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{s.name}</p>
                  <p className="text-xs text-[#7c8091]">{s.quantity} {s.unit} restants · seuil {s.alert_threshold} · {s.depot_code}</p>
                </div>
                <Link href="/admin/stocks" className="text-xs font-bold text-[#2f6eb5] hover:underline">Réappro →</Link>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Étapes en retard */}
      <GlassCard>
        <SectionTitle kicker="Temps" title="Étapes en retard" hint="variance > 0 — réel vs cible." />
        {overdue.length === 0 ? <Empty icon="⏱️" title="Aucun retard" hint="Toutes les étapes sont dans les temps." /> : (
          <div className="grid gap-2.5 md:grid-cols-2">
            {overdue.map((s: any) => (
              <div key={s.id} className="card flex items-center gap-3 p-3.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-red-50 text-red-500"><AlarmClock size={17} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">#{s.step_order} {s.step_name}</p>
                  <p className="text-xs text-[#7c8091]">Réel {Number(s.actual_minutes ?? 0).toFixed(0)} min / cible {s.estimated_minutes} min · <Package size={10} className="inline" /> {s.item_id?.slice(0, 8)}</p>
                </div>
                <span className="rounded-lg bg-red-50 border border-red-200 px-2 py-1 text-xs font-black text-red-500">
                  +{Number(s.variance_min ?? 0).toFixed(0)}m
                </span>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
