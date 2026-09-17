"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { FolderOpen, Search, Package, Boxes, Factory, ArrowLeftRight, FileText, Home } from "lucide-react";
import { GlassCard, SectionTitle, StatusPill, Empty } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

type Props = { usine: string; dossiers: any[]; receptions: any[] };

export default function ArchivesClient({ usine, dossiers, receptions }: Props) {
  const [recherche, setRecherche] = useState("");
  const [statut, setStatut] = useState<string>("TOUS");
  const [ouvert, setOuvert] = useState<string | null>(null);

  const visibles = useMemo(() => {
    return dossiers.filter((d) => {
      if (statut !== "TOUS" && d.order.status !== statut) return false;
      if (recherche) {
        const q = recherche.toLowerCase();
        const hitOrder = d.order.order_number.toLowerCase().includes(q);
        const hitItem = d.items.some((i: any) => (i.product_name ?? "").toLowerCase().includes(q));
        if (!hitOrder && !hitItem) return false;
      }
      return true;
    });
  }, [dossiers, recherche, statut]);

  const statuts = useMemo(() => Array.from(new Set(dossiers.map((d) => d.order.status))), [dossiers]);
  const detail = ouvert ? dossiers.find((d) => d.order.id === ouvert) : null;

  return (
    <div className="stagger space-y-5">
      <div className="card flex flex-wrap items-center gap-2 p-3">
        <span className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
          <input value={recherche} onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher commande ou article…"
            className="input pl-9 pr-3 py-2 text-[13px] w-[260px]" />
        </span>
        <button onClick={() => setStatut("TOUS")}
          className={cn("rounded-xl border px-3 py-1.5 text-[12px] font-bold", statut === "TOUS" ? "border-[#4a7c59]/40 bg-[#4a7c59]/10 text-[#4a7c59]" : "border-black/10 text-[#7c8091]")}>
          Tous
        </button>
        {statuts.map((s: string) => (
          <button key={s} onClick={() => setStatut(s === statut ? "TOUS" : s)}
            className={cn("rounded-xl border px-3 py-1.5 text-[12px] font-bold", statut === s ? "border-[#4a7c59]/40 bg-[#4a7c59]/10 text-[#4a7c59]" : "border-black/10 text-[#7c8091]")}>
            {s}
          </button>
        ))}
        <span className="ml-auto text-[12px] font-semibold text-[#9ca3af]">{visibles.length} dossier(s) · usine {usine}</span>
      </div>

      {visibles.length === 0 ? (
        <Empty icon="🗂️" title="Aucun dossier" hint="Aucune commande ne correspond à la recherche." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {visibles.map((d: any) => (
            <button key={d.order.id} onClick={() => setOuvert(ouvert === d.order.id ? null : d.order.id)}
              className={cn("card p-4 text-left transition hover:border-[#4a7c59]/30", ouvert === d.order.id && "border-[#4a7c59]/40")}>
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#4a7c59]/10 text-[#4a7c59]"><FolderOpen size={18} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-extrabold">{d.order.order_number}</span>
                    <StatusPill status={d.order.status} />
                  </div>
                  <p className="text-[11px] text-[#9ca3af]">
                    {d.items.length} article(s) · {d.steps.length} étape(s) · {d.transfers.length + d.destinations.length} bordereau(x) · {d.order.created_at ? new Date(d.order.created_at).toLocaleDateString("fr-FR") : "—"}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Détail dossier */}
      {detail && (
        <GlassCard>
          <SectionTitle kicker="Dossier" title={`${detail.order.order_number} — usine ${usine}`}
            hint={`${detail.items.length} articles · statut final : ${detail.order.status}`}
            right={<Link href={`/admin/orders/${detail.order.id}`} className="text-[12px] font-bold text-[#4a7c59] hover:underline">Ouvrir la commande →</Link>} />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-black/[0.06] p-4">
              <p className="mb-2 flex items-center gap-1.5 text-[12px] font-black uppercase tracking-wider text-[#7c8091]"><Package size={13} /> Articles & quantités</p>
              {detail.items.length === 0 ? <p className="text-[12px] text-[#9ca3af]">Aucun article.</p> : (
                <ul className="space-y-1.5">
                  {detail.items.map((i: any) => (
                    <li key={i.id} className="flex items-center gap-2 text-[13px]">
                      <span className="font-bold">{i.product_name}</span>
                      <span className="text-[#7c8091]">×{i.quantity}</span>
                      <span className="ml-auto"><StatusPill status={i.status} /></span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mb-2 mt-4 flex items-center gap-1.5 text-[12px] font-black uppercase tracking-wider text-[#7c8091]"><Boxes size={13} /> Réservations MP</p>
              {detail.reservations.length === 0 ? <p className="text-[12px] text-[#9ca3af]">Aucune réserve.</p> : (
                <ul className="space-y-1.5">
                  {detail.reservations.map((r: any) => (
                    <li key={r.id} className="text-[13px]">
                      <span className="font-bold">{r.stock_items?.name ?? "Matière"}</span>
                      <span className="text-[#7c8091]"> — estimé {r.estimated_qty} · consommé {r.consumed_qty ?? 0} {r.stock_items?.unit ?? ""}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-black/[0.06] p-4">
              <p className="mb-2 flex items-center gap-1.5 text-[12px] font-black uppercase tracking-wider text-[#7c8091]"><Factory size={13} /> Déclarations ateliers</p>
              {detail.logs.length === 0 && detail.steps.length === 0 ? <p className="text-[12px] text-[#9ca3af]">Aucune déclaration.</p> : (
                <ul className="space-y-1.5">
                  {detail.logs.map((l: any) => (
                    <li key={l.id} className="text-[13px]">
                      <span className="font-bold">{l.stock_items?.name ?? "Matière"}</span>
                      <span className="text-[#7c8091]"> — utilisée {l.quantity_used ?? 0} · perdue {l.quantity_lost ?? 0} · OK {l.quantity_ok ?? 0}</span>
                    </li>
                  ))}
                  {detail.logs.length === 0 && detail.steps.map((s: any) => (
                    <li key={s.id} className="flex items-center gap-2 text-[13px]">
                      <span className="font-bold">#{s.step_order} {s.step_name}</span>
                      <span className="text-[#7c8091]">OK {s.quantity_ok ?? 0}</span>
                      <span className="ml-auto"><StatusPill status={s.status} /></span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mb-2 mt-4 flex items-center gap-1.5 text-[12px] font-black uppercase tracking-wider text-[#7c8091]"><ArrowLeftRight size={13} /> Bordereaux transferts / destinations</p>
              {detail.transfers.length === 0 && detail.destinations.length === 0 ? <p className="text-[12px] text-[#9ca3af]">Aucun bordereau.</p> : (
                <ul className="space-y-1.5">
                  {detail.transfers.map((t: any) => (
                    <li key={t.id} className="font-mono text-[12px] font-bold text-[#7c3aed]">{t.manifest_qr ?? t.id?.slice(0, 8)} <span className="font-sans font-normal text-[#7c8091]">→ {t.destination ?? "—"} · {t.status}</span></li>
                  ))}
                  {detail.destinations.map((d: any) => (
                    <li key={d.id} className="font-mono text-[12px] font-bold text-[#4a7c59]">{d.bordereau ?? d.id?.slice(0, 8)} <span className="font-sans font-normal text-[#7c8091]">→ {d.destination === "MOBILIX" ? "MOBILIX" : "Client direct"} · {d.statut}</span></li>
                  ))}
                </ul>
              )}
              {detail.movements.length > 0 && (
                <>
                  <p className="mb-2 mt-4 flex items-center gap-1.5 text-[12px] font-black uppercase tracking-wider text-[#7c8091]"><Home size={13} /> Mouvements stock liés</p>
                  <ul className="max-h-32 space-y-1 overflow-y-auto">
                    {detail.movements.slice(0, 20).map((m: any) => (
                      <li key={m.id} className="text-[12px] text-[#7c8091]">{m.movement_type} {m.quantity} {m.stock_items?.unit ?? ""} — {m.stock_items?.name ?? ""}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </GlassCard>
      )}

      {/* Factures réception liées */}
      <GlassCard>
        <SectionTitle kicker="Achats" title="Factures de réception liées" hint={`Réceptions MP confirmées — usine ${usine}.`} />
        {receptions.length === 0 ? (
          <Empty icon="🧾" title="Aucune réception" hint="Les factures confirmées apparaîtront ici." />
        ) : (
          <div className="space-y-2">
            {receptions.map((r: any) => (
              <div key={r.id} className="card flex items-center gap-3 p-3.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#2f6eb5]/10 text-[#2f6eb5]"><FileText size={16} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold">{r.fournisseurs?.nom ?? "Fournisseur"} · {r.numero_facture || "sans n°"}</p>
                  <p className="text-[11px] text-[#7c8091]">{(r.lignes ?? []).length} ligne(s) · {r.created_at ? new Date(r.created_at).toLocaleDateString("fr-FR") : "—"}</p>
                </div>
                <StatusPill status={r.statut === "CONFIRMEE" ? "VERIFIED" : "PENDING"} />
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
