"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Package, ArrowRight, CheckCircle2, Circle, Loader, Truck, Home } from "lucide-react";
import { GlassCard, SectionTitle, StatusPill, Empty } from "@/components/admin/ui";
import { ATELIERS } from "@/lib/ateliers";
import { cn } from "@/lib/utils";

type Props = {
  usine: string;
  orders: any[];
  items: any[];
  steps: any[];
  semi: any[];
  destinations: any[];
  transfers: any[];
};

// Noms repris de la source unique lib/ateliers.ts — jamais recopiés à la main,
// sinon l'écran continue d'afficher « Bois & Découpe » pour l'Atelier 1 tôle.
const ATELIER_NOM: Record<number, string> = Object.fromEntries(
  ATELIERS.map((a) => [a.id, a.nom])
);

function etapeRoadmap(order: any, orderItems: any[], allSteps: any[], allSemi: any[], allDest: any[], allTrans: any[]) {
  // Commande → Réservé → En production → Stock atelier → Décision → MOBILIX/Livré
  const itemIds = new Set(orderItems.map((i) => i.id));
  const steps = allSteps.filter((s) => itemIds.has(s.item_id));
  const semiLots = allSemi.filter((s) => itemIds.has(s.item_id ?? s.order_item_id));
  const dests = allDest.filter((d) => itemIds.has(d.order_item_id) || semiLots.some((s) => s.id === d.semi_stock_id));
  const trans = allTrans.filter((t) => t.order_id === order.id || orderItems.some((i) => i.id === t.order_item_id));

  const enProduction = steps.find((s) => s.status === "ACTIVE" || s.status === "IN_PROGRESS");
  const terminees = steps.filter((s) => s.status === "DONE" || s.status === "COMPLETED").length;
  const decidee = dests.length > 0 ? dests[0] : null;
  const expedie = trans.find((t) => t.status === "VERIFIED" || t.status === "DELIVERED" || t.status === "RELEASED");

  const phases = [
    { key: "commande", label: "Commande", done: true, detail: `${orderItems.length} article(s) · ${order.order_number}` },
    { key: "reserve", label: "Réservé", done: orderItems.length > 0, detail: orderItems.length > 0 ? "Matières réservées" : "En attente de réservation" },
    {
      key: "production", label: "En production",
      done: terminees > 0 || !!enProduction, active: !!enProduction && terminees < steps.length,
      detail: enProduction
        ? `${ATELIER_NOM[enProduction.atelier_id] ?? `Atelier ${enProduction.atelier_id}`} · ${enProduction.step_name}`
        : terminees > 0 ? `${terminees}/${steps.length} étape(s) terminée(s)` : "Pas encore démarrée"
    },
    {
      key: "stock", label: "Stock atelier",
      done: semiLots.length > 0,
      detail: semiLots.length > 0 ? `${semiLots.length} lot(s) semi-fini(s)` : "Aucun lot semi-fini"
    },
    {
      key: "decision", label: "Décision destination",
      done: !!decidee,
      detail: decidee ? `${decidee.destination === "MOBILIX" ? "Vers MOBILIX" : "Client direct"} · ${decidee.bordereau ?? ""}` : "En attente de décision"
    },
    {
      key: "final", label: decidee?.destination === "CLIENT_DIRECT" ? "Livré" : "MOBILIX",
      done: !!expedie || decidee?.statut === "LIVRE" || decidee?.statut === "EXPEDIE",
      detail: expedie ? `${expedie.manifest_qr ?? "Bordereau"} · ${expedie.status}` : "En attente d'expédition"
    }
  ];
  const doneCount = phases.filter((p) => p.done).length;
  return { phases, doneCount, total: phases.length, pct: Math.round((doneCount / phases.length) * 100) };
}

export default function RoadmapClient({ usine, orders, items, steps, semi, destinations, transfers }: Props) {
  const [filtre, setFiltre] = useState<"TOUS" | "EN_COURS" | "EN_ATTENTE" | "TERMINE">("TOUS");
  const [recherche, setRecherche] = useState("");

  const lignes = useMemo(() => {
    return orders.map((o) => {
      const oItems = items.filter((i) => i.order_id === o.id);
      const r = etapeRoadmap(o, oItems, steps, semi, destinations, transfers);
      const statutGroupe =
        ["RELEASED", "DELIVERED", "CANCELLED"].includes(o.status) || r.pct === 100 ? "TERMINE"
        : r.doneCount <= 2 ? "EN_ATTENTE" : "EN_COURS";
      return { order: o, items: oItems, ...r, statutGroupe };
    });
  }, [orders, items, steps, semi, destinations, transfers]);

  const visibles = lignes.filter((l) => {
    if (filtre !== "TOUS" && l.statutGroupe !== filtre) return false;
    if (recherche && !l.order.order_number.toLowerCase().includes(recherche.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="stagger space-y-5">
      <div className="card flex flex-wrap items-center gap-2 p-3">
        <span className="px-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[#7c8091]">Usine {usine}</span>
        {(["TOUS", "EN_COURS", "EN_ATTENTE", "TERMINE"] as const).map((f) => (
          <button key={f} onClick={() => setFiltre(f)}
            className={cn("rounded-xl border px-3 py-1.5 text-[12px] font-bold transition",
              filtre === f ? "border-[#4a7c59]/40 bg-[#4a7c59]/10 text-[#4a7c59]" : "border-black/10 text-[#7c8091] hover:text-[#1a1d23]")}>
            {f === "TOUS" ? "Toutes" : f === "EN_COURS" ? "En cours" : f === "EN_ATTENTE" ? "En attente" : "Terminées"}
          </button>
        ))}
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher n° commande…"
          className="input ml-auto max-w-[220px] px-3 py-1.5 text-[12px]" />
      </div>

      {visibles.length === 0 ? (
        <Empty icon="🗺️" title="Aucune commande" hint="Aucune commande ne correspond au filtre." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visibles.map(({ order, items: oItems, phases, pct }) => (
            <GlassCard key={order.id}>
              <div className="mb-3 flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#4a7c59]/10 text-[#4a7c59]"><Package size={17} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/orders/${order.id}`} className="text-[14px] font-extrabold text-[#1a1d23] hover:underline">
                      {order.order_number}
                    </Link>
                    <StatusPill status={order.status} />
                  </div>
                  <p className="text-[11px] text-[#9ca3af]">{oItems.length} article(s) · {order.created_at ? new Date(order.created_at).toLocaleDateString("fr-FR") : "—"} · {pct}%</p>
                </div>
                <span className="text-[12px] font-black text-[#4a7c59]">{pct}%</span>
              </div>
              <div className="mb-4 h-2 overflow-hidden rounded-full bg-black/[0.05]">
                <div className="h-full rounded-full bg-gradient-to-r from-[#4a7c59] to-[#7c3aed] transition-all" style={{ width: `${pct}%` }} />
              </div>
              {/* Timeline verticale */}
              <ol className="relative space-y-0 border-l-2 border-black/[0.06] ml-2 pl-0">
                {phases.map((p, idx) => (
                  <li key={p.key} className="relative flex gap-3 pb-4 pl-5 last:pb-0">
                    <span className={cn("absolute -left-[9px] top-0.5 grid h-4 w-4 place-items-center rounded-full border-2 bg-white",
                      p.done ? "border-[#4a7c59]" : (p as any).active ? "border-[#2f6eb5]" : "border-black/15")}>
                      {p.done
                        ? <CheckCircle2 size={10} className="text-[#4a7c59]" />
                        : (p as any).active ? <Loader size={10} className="text-[#2f6eb5]" /> : <Circle size={8} className="text-black/20" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-[13px] font-bold", p.done ? "text-[#1a1d23]" : "text-[#9ca3af]")}>
                        {idx + 1}. {p.label}
                        {(p as any).active && <span className="ml-2 rounded-full bg-[#2f6eb5]/10 px-2 py-0.5 text-[10px] font-black text-[#2f6eb5]">EN COURS</span>}
                      </p>
                      <p className="truncate text-[11px] text-[#7c8091]">{p.detail}</p>
                    </div>
                    {p.key === "final" && p.done && (
                      <span className="shrink-0">{(p.label === "MOBILIX") ? <Truck size={14} className="text-[#7c3aed]" /> : <Home size={14} className="text-[#4a7c59]" />}</span>
                    )}
                  </li>
                ))}
              </ol>
              <Link href={`/admin/orders/${order.id}`} className="mt-3 inline-flex items-center gap-1 text-[12px] font-bold text-[#4a7c59] hover:underline">
                Ouvrir la commande <ArrowRight size={12} />
              </Link>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
