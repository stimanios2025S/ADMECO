"use client";
import { useState } from "react";
import { Package, AlertTriangle, CheckCircle, Truck, Plus, Pencil, Trash2, X } from "lucide-react";
import { GlassCard, SectionTitle, Stat, StatusPill, Empty } from "@/components/admin/ui";
import { adjustStock, addStockItem, deleteStockItem } from "@/app/actions";
import { stockHealth, fmtQty } from "@/lib/calc/stock";
import { mouvementFr } from "@/lib/fr";
import { DEPOTS, depotNom } from "@/lib/ateliers";
import { cn } from "@/lib/utils";

type StockRow = { id: string; name: string; unit: string; quantity: number; reserved: number; available: number; low_stock: boolean; alert_threshold: number; depot_code?: string };
type MovRow = { id: string; movement_type: string; quantity: number; note: string; created_at: string; stock_items?: { name: string; unit: string } };
type SemiRow = { id: string; quantity: number; status: string; created_at: string; work_order_items?: { product_name: string; quantity: number } };

export default function StocksClient({ stocks, movements, reservations, semiStock }: { stocks: StockRow[]; movements: MovRow[]; reservations: any[]; semiStock: SemiRow[] }) {
  const [tab, setTab] = useState<"inventory" | "movements" | "semi">("inventory");
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<StockRow | null>(null);
  const [depot, setDepot] = useState<string>("TOUS");

  const mp = stocks.filter((s) => (s.depot_code ?? "DEP-MP") === "DEP-MP");
  const a1count = semiStock.filter((s: any) => (s as any).atelier_id === 1 && s.status === "PENDING").length;
  const a2count = semiStock.filter((s: any) => (s as any).atelier_id === 2 && s.status === "PENDING").length;
  const visible = depot === "TOUS" ? stocks : stocks.filter((s) => (s.depot_code ?? "DEP-MP") === depot);

  const totalStock = visible.reduce((a, s) => a + s.quantity, 0);
  const totalReserved = visible.reduce((a, s) => a + s.reserved, 0);
  const lowCount = visible.filter((s) => s.low_stock).length;
  const pendingSemi = semiStock.filter((s) => s.status === "PENDING").length;

  return (
    <div className="stagger space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card flex items-center gap-3 p-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#c24a08]/10 text-[#c24a08] shadow-sm"><Package size={20} /></span>
          <div><p className="text-2xl font-black">{stocks.length}</p><p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Articles en stock</p></div>
        </div>
        <Stat label="Quantité totale" value={totalStock.toLocaleString()} sub="Toutes matières confondues" accent="ice" />
        <Stat label="Réservé" value={totalReserved.toLocaleString()} sub="Bloqué pour la production" accent="fire" />
        <div className="card flex items-center gap-3 p-4">
          <span className={cn("grid h-11 w-11 place-items-center rounded-xl", lowCount > 0 ? "bg-red-50 text-red-500" : "bg-[#4a7c59]/10 text-[#4a7c59]")}>
            {lowCount > 0 ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
          </span>
          <div><p className="text-2xl font-black">{lowCount}</p><p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Alertes stock bas</p></div>
        </div>
      </div>

      {pendingSemi > 0 && (
        <GlassCard className="border-amber-200 bg-amber-50">
          <SectionTitle kicker="Prêt" title={`${pendingSemi} articles au stock semi-fini`} hint="En attente de libération vers l'Atelier 2." right={
            <a href="/admin/orders" className="btn-fire inline-flex items-center gap-1 px-4 py-2 text-sm"><Truck size={15} /> Voir les commandes</a>
          } />
        </GlassCard>
      )}

      {/* 3 stocks : MP centrale / Stock A1 (produit par A1) / Stock A2 (produit par A2) */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="card border-[#4a7c59]/20 p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#4a7c59]">Matière Première — Centrale</p>
          <p className="text-2xl font-black">{mp.length} <span className="text-sm font-medium text-[#7c8091]">articles</span></p>
          <p className="text-xs text-[#7c8091]">Alimente Atelier 1 + Atelier 2 au début · Réservé {mp.reduce((a, s) => a + s.reserved, 0).toLocaleString()}</p>
        </div>
        <div className="card border-amber-200 p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-amber-600">Stock Atelier 1 — Produit par A1</p>
          <p className="text-2xl font-black">{a1count} <span className="text-sm font-medium text-[#7c8091]">lots en attente</span></p>
          <p className="text-xs text-[#7c8091]">Semi-finis A1 → transfert vers Atelier 2</p>
        </div>
        <div className="card border-[#2f6eb5]/20 p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#2f6eb5]">Stock Atelier 2 — Produit par A2</p>
          <p className="text-2xl font-black">{a2count} <span className="text-sm font-medium text-[#7c8091]">lots en attente</span></p>
          <p className="text-xs text-[#7c8091]">Finis A2 → expédition</p>
        </div>
      </div>

      <div className="card flex flex-wrap gap-1.5 p-2">
        {(["inventory", "movements", "semi"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("rounded-xl border px-4 py-2 text-sm font-bold transition",
            tab === t ? "border-[#4a7c59]/30 bg-[#4a7c59]/10 text-[#4a7c59]" : "border-black/8 text-[#7c8091] hover:text-[#1a1d23]")}>
            {t === "inventory" ? "📦 Matière Première" : t === "movements" ? "🔄 Mouvements" : "🏗️ Stocks Ateliers"}
          </button>
        ))}
        <select value={depot} onChange={(e) => setDepot(e.target.value)} className="input ml-auto max-w-[260px]" title="Filtrer par dépôt">
          <option value="TOUS">Tous dépôts</option>
          {DEPOTS.map((d) => <option key={d.code} value={d.code}>{d.nom}</option>)}
        </select>
      </div>

      {tab === "inventory" && (
        <GlassCard>
          <SectionTitle kicker="Matières" title="Matière Première centrale — alimente A1 + A2" hint="Réservé à la création commande, retiré seulement au déclaré de chaque étape."
            right={<button onClick={() => setAddOpen(true)} className="btn-fire inline-flex items-center gap-1 px-4 py-2 text-sm"><Plus size={15} /> Ajouter</button>} />
          {visible.length === 0 ? <Empty icon="📦" title="Aucun article dans ce dépôt" hint="Ajoutez votre première matière ci-dessus." /> : (
            <div className="space-y-1.5">
              {visible.map((s) => {
                const health = stockHealth(s);
                return (
                  <div key={s.id} className="card flex items-center gap-3 p-3">
                    <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg",
                      health === "ok" ? "bg-emerald-50" : health === "low" ? "bg-amber-50" : "bg-red-50")}>
                      {health === "ok" ? "✅" : health === "low" ? "⚠️" : "🔴"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{s.name} <span className="ml-1 rounded-lg bg-black/5 px-1.5 py-0.5 text-[10px] font-bold text-[#7c8091]">{depotNom(s.depot_code)}</span></p>
                      <p className="text-xs text-[#7c8091]">{fmtQty(s.quantity, s.unit)} · Réservé {fmtQty(s.reserved, s.unit)} · Dispo {fmtQty(s.available, s.unit)}</p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button onClick={() => setEditItem(s)} className="btn-ghost grid h-8 w-8 place-items-center" title="Ajuster"><Pencil size={14} /></button>
                      <button onClick={async () => { if (confirm(`Supprimer « ${s.name} » ?`)) await deleteStockItem(s.id); }}
                        className="grid h-8 w-8 place-items-center rounded-xl border border-red-200 bg-red-50 text-red-500" title="Supprimer"><Trash2 size={14} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      )}

      {tab === "movements" && (
        <GlassCard>
          <SectionTitle kicker="Historique" title="Mouvements de stock" hint="Chaque action réserver / consommer / ajuster." />
          {movements.length === 0 ? <Empty icon="🔄" title="Aucun mouvement" hint="L'activité apparaîtra ici une fois la production lancée." /> : (
            <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
              {movements.map((m) => (
                <div key={m.id} className="card flex items-center gap-3 p-3 text-sm">
                  <span className={cn("rounded-lg px-2 py-0.5 text-xs font-black",
                    m.movement_type === "consume" ? "bg-red-50 text-red-500" :
                    m.movement_type === "reserve" ? "bg-amber-50 text-amber-600" :
                    m.movement_type === "adjust" ? "bg-[#2f6eb5]/10 text-[#2f6eb5]" : "bg-[#4a7c59]/10 text-[#4a7c59]")}>
                    {mouvementFr(m.movement_type)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{m.stock_items?.name}</p>
                    <p className="text-xs text-[#7c8091]">{m.note ?? "—"}</p>
                  </div>
                  <span className="font-mono text-xs font-bold">{m.movement_type === "adjust" ? "+" : "-"}{m.quantity}</span>
                  <span className="hidden text-xs text-[#7c8091] sm:block">{new Date(m.created_at).toLocaleString("fr-FR")}</span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      )}

      {tab === "semi" && (
        <GlassCard>
          <SectionTitle kicker="Prêt" title="Produits semi-finis" hint="Articles terminés en attente de libération vers l'Atelier 2." />
          {semiStock.length === 0 ? <Empty icon="🏗️" title="Aucun produit semi-fini" hint="Terminez toutes les étapes pour voir les articles ici." /> : (
            <div className="grid gap-2.5 md:grid-cols-2">
              {semiStock.map((s) => (
                <div key={s.id} className="card flex items-center gap-3 p-3.5">
                  <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg",
                    s.status === "RELEASED" ? "bg-emerald-50" : "bg-amber-50")}>
                    {s.status === "RELEASED" ? "✅" : "🏗️"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">{s.work_order_items?.product_name}</p>
                    <p className="text-xs text-[#7c8091]">×{s.quantity} · {new Date(s.created_at).toLocaleDateString("fr-FR")}</p>
                  </div>
                  <StatusPill status={s.status} />
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      )}

      {addOpen && (
        <div className="fixed inset-0 z-[90] grid place-items-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setAddOpen(false)} />
          <AddItemModal onClose={() => setAddOpen(false)} />
        </div>
      )}
      {editItem && (
        <div className="fixed inset-0 z-[90] grid place-items-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setEditItem(null)} />
          <AdjustModal item={editItem} onClose={() => setEditItem(null)} />
        </div>
      )}
    </div>
  );
}

function AddItemModal({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState({ name: "", unit: "pcs", quantity: 0, alert_threshold: 10, depot_code: "DEP-MP" });
  const [busy, setBusy] = useState(false);
  return (
    <form className="card w-full max-w-md space-y-3 p-6" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); await addStockItem(f.name, f.unit, f.quantity, f.alert_threshold, f.depot_code); setBusy(false); onClose();
    }}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black">Ajouter un article</h3>
        <button type="button" onClick={onClose} className="btn-ghost grid h-8 w-8 place-items-center"><X size={16} /></button>
      </div>
      <input required placeholder="Nom de la matière" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="input w-full px-4 py-2.5 text-sm" />
      <select value={f.depot_code} onChange={(e) => setF({ ...f, depot_code: e.target.value })} className="input w-full px-4 py-2.5 text-sm" title="Dépôt">
        {DEPOTS.map((d) => <option key={d.code} value={d.code}>{d.nom} — {d.detail}</option>)}
      </select>
      <div className="grid grid-cols-3 gap-2">
        <select value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} className="input px-2 py-2.5 text-sm">
          {["pcs", "m", "m²", "kg", "L", "pcs"].map((u) => <option key={u} value={u} className="bg-white">{u}</option>)}
        </select>
        <input type="number" step="any" min={0} value={f.quantity} onChange={(e) => setF({ ...f, quantity: Number(e.target.value) })}
          className="input px-2 py-2.5 text-sm" placeholder="Qté" />
        <input type="number" step="any" min={0} value={f.alert_threshold} onChange={(e) => setF({ ...f, alert_threshold: Number(e.target.value) })}
          className="input px-2 py-2.5 text-sm" placeholder="Seuil" />
      </div>
      <button disabled={busy} className="btn-fire w-full px-4 py-2.5 text-sm">{busy ? "…" : "Ajouter"}</button>
    </form>
  );
}

function AdjustModal({ item, onClose }: { item: StockRow; onClose: () => void }) {
  const [qty, setQty] = useState(item.quantity);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form className="card w-full max-w-md space-y-3 p-6" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); await adjustStock(item.id, qty, note); setBusy(false); onClose();
    }}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black">Ajuster : {item.name}</h3>
        <button type="button" onClick={onClose} className="btn-ghost grid h-8 w-8 place-items-center"><X size={16} /></button>
      </div>
      <p className="text-sm text-[#7c8091]">Actuel : {fmtQty(item.quantity, item.unit)}</p>
      <input type="number" step="any" min={0} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="input w-full px-4 py-3 text-lg font-bold" />
      <input placeholder="Motif d'ajustement (optionnel)" value={note} onChange={(e) => setNote(e.target.value)} className="input w-full px-4 py-2.5 text-sm" />
      <button disabled={busy} className="btn-fire w-full px-4 py-2.5 text-sm">{busy ? "…" : "Enregistrer"}</button>
    </form>
  );
}
