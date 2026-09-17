"use client";
import { useState } from "react";
import { Truck, Home, Package, ArrowLeftRight } from "lucide-react";
import { GlassCard, SectionTitle, StatusPill, Empty } from "@/components/admin/ui";
import { deciderDestination } from "@/app/actions-usines";
import { cn } from "@/lib/utils";

type Props = { usine: string; enAttente: any[]; decisions: any[]; receptionsMobilix: any[] };

export default function DestinationsClient({ usine, enAttente, decisions, receptionsMobilix }: Props) {
  const isMobilix = usine === "MOBILIX";
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const decider = async (lot: any, destination: "MOBILIX" | "CLIENT_DIRECT") => {
    setBusy(lot.id);
    const r = await deciderDestination({ semiStockId: lot.id, orderItemId: lot.item_id ?? lot.order_item_id ?? undefined, destination });
    setBusy(null);
    setMsg({ ok: r.ok, text: r.message });
    if (r.ok) window.location.reload();
  };

  return (
    <div className="stagger space-y-5">
      {msg && (
        <div className={cn("rounded-xl border px-4 py-2.5 text-[13px] font-semibold",
          msg.ok ? "border-[#4a7c59]/30 bg-[#4a7c59]/[0.06] text-[#4a7c59]" : "border-red-200 bg-red-50 text-red-600")}>
          {msg.text}
        </div>
      )}

      {isMobilix ? (
        <GlassCard>
          <SectionTitle kicker="MOBILIX" title="Réceptions en attente"
            hint="Lots envoyés par ADMEDCO vers MOBILIX." />
          {receptionsMobilix.length === 0 ? (
            <Empty icon="🚚" title="Aucune réception en attente" hint="Les transferts ADMEDCO → MOBILIX apparaîtront ici." />
          ) : (
            <div className="space-y-2">
              {receptionsMobilix.map((t: any) => (
                <div key={t.id} className="card flex items-center gap-3 p-3.5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#7c3aed]/10 text-[#7c3aed]"><Truck size={18} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-bold text-[#7c3aed]">{t.manifest_qr ?? t.id?.slice(0, 8)}</p>
                    <p className="text-xs text-[#7c8091]">Destination MOBILIX · {t.created_at ? new Date(t.created_at).toLocaleString("fr-FR") : "—"}</p>
                  </div>
                  <StatusPill status={t.status ?? "PENDING"} />
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      ) : (
        <GlassCard>
          <SectionTitle kicker="Décision" title="Lots en attente de destination"
            hint="Seul ADMEDCO décide : MOBILIX ou client direct." />
          {enAttente.length === 0 ? (
            <Empty icon="📦" title="Rien à décider" hint="Tous les lots semi-finis ont une destination." />
          ) : (
            <div className="grid gap-2.5 md:grid-cols-2">
              {enAttente.map((l: any) => (
                <div key={l.id} className="card flex flex-col gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600"><Package size={18} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{l.work_order_items?.product_name ?? `Lot ${String(l.id).slice(0, 8)}`}</p>
                      <p className="text-xs text-[#7c8091]">×{l.quantity} · {l.work_order_items?.work_orders?.order_number ?? ""} · {l.created_at ? new Date(l.created_at).toLocaleDateString("fr-FR") : "—"}</p>
                    </div>
                    <StatusPill status={l.status ?? "PENDING"} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button disabled={busy === l.id} onClick={() => decider(l, "MOBILIX")}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#7c3aed] px-3 py-2.5 text-[12px] font-bold text-white hover:bg-[#6d28d9] disabled:opacity-50">
                      <Truck size={14} /> {busy === l.id ? "…" : "Envoyer à MOBILIX"}
                    </button>
                    <button disabled={busy === l.id} onClick={() => decider(l, "CLIENT_DIRECT")}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#4a7c59] px-3 py-2.5 text-[12px] font-bold text-white hover:bg-[#3a6b48] disabled:opacity-50">
                      <Home size={14} /> {busy === l.id ? "…" : "Livraison client direct"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      )}

      <GlassCard>
        <SectionTitle kicker="Historique" title="Décisions & bordereaux" hint="Toutes les destinations décidées." />
        {decisions.length === 0 ? (
          <Empty icon="🧾" title="Aucune décision" hint="L'historique des bordereaux apparaîtra ici." />
        ) : (
          <div className="space-y-2">
            {decisions.map((d: any) => (
              <div key={d.id} className="card flex items-center gap-3 p-3.5">
                <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                  d.destination === "MOBILIX" ? "bg-[#7c3aed]/10 text-[#7c3aed]" : "bg-[#4a7c59]/10 text-[#4a7c59]")}>
                  {d.destination === "MOBILIX" ? <ArrowLeftRight size={16} /> : <Home size={16} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-bold">{d.bordereau ?? d.id?.slice(0, 8)}</p>
                  <p className="text-xs text-[#7c8091]">
                    {d.destination === "MOBILIX" ? "Vers MOBILIX" : "Client direct"} · {d.created_at ? new Date(d.created_at).toLocaleString("fr-FR") : "—"}
                  </p>
                </div>
                <StatusPill status={d.statut ?? "DECIDE"} />
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
