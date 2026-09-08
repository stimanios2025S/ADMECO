"use client";
import { useState } from "react";
import { Package, AlertTriangle, CheckCircle, Clock, Truck, Plus, Pencil, Trash2, X } from "lucide-react";
import { GlassCard, SectionTitle, Stat, StatusPill, Empty } from "@/components/admin/ui";
import { adjustStock, addStockItem, deleteStockItem } from "@/app/actions";
import { stockHealth, fmtQty } from "@/lib/calc/stock";
import { cn } from "@/lib/utils";

type StockRow = { id: string; name: string; unit: string; quantity: number; reserved: number; available: number; low_stock: boolean; alert_threshold: number };
type MovRow = { id: string; movement_type: string; quantity: number; note: string; created_at: string; stock_items?: { name: string; unit: string } };
type SemiRow = { id: string; quantity: number; status: string; created_at: string; work_order_items?: { product_name: string; quantity: number } };

export default function StocksClient({ stocks, movements, reservations, semiStock }: { stocks: StockRow[]; movements: MovRow[]; reservations: any[]; semiStock: SemiRow[] }) {
  const [tab, setTab] = useState<"inventory" | "movements" | "semi">("inventory");
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<StockRow | null>(null);

  const totalStock = stocks.reduce((a, s) => a + s.quantity, 0);
  const totalReserved = stocks.reduce((a, s) => a + s.reserved, 0);
  const lowCount = stocks.filter((s) => s.low_stock).length;
  const pendingSemi = semiStock.filter((s) => s.status === "PENDING").length;

  return (
    <div className="stagger space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card flex items-center gap-3 p-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#c24a08]/10 text-[#c24a08] shadow-sm"><Package size={20} /></span>
          <div><p className="text-2xl font-black">{stocks.length}</p><p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Stock items</p></div>
        </div>
        <Stat label="Total quantity" value={totalStock.toLocaleString()} sub="Across all materials" accent="ice" />
        <Stat label="Reserved" value={totalReserved.toLocaleString()} sub="Locked for production" accent="fire" />
        <div className="card flex items-center gap-3 p-4">
          <span className={cn("grid h-11 w-11 place-items-center rounded-xl", lowCount > 0 ? "bg-red-50 text-red-500" : "bg-[#4a7c59]/10 text-[#4a7c59]")}>
            {lowCount > 0 ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
          </span>
          <div><p className="text-2xl font-black">{lowCount}</p><p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Low stock alerts</p></div>
        </div>
      </div>

      {pendingSemi > 0 && (
        <GlassCard className="border-amber-200 bg-amber-50">
          <SectionTitle kicker="Ready" title={`${pendingSemi} items at semi-finished stock`} hint="Waiting for admin release to MOBILIX." right={
            <a href="/admin/orders" className="btn-fire inline-flex items-center gap-1 px-4 py-2 text-sm"><Truck size={15} /> Review orders</a>
          } />
        </GlassCard>
      )}

      <div className="card flex gap-1.5 p-2">
        {(["inventory", "movements", "semi"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("rounded-xl border px-4 py-2 text-sm font-bold transition",
            tab === t ? "border-[#4a7c59]/30 bg-[#4a7c59]/10 text-[#4a7c59]" : "border-black/8 text-[#7c8091] hover:text-[#1a1d23]")}>
            {t === "inventory" ? "📦 Inventory" : t === "movements" ? "🔄 Movements" : "🏗️ Semi-finished"}
          </button>
        ))}
      </div>

      {tab === "inventory" && (
        <GlassCard>
          <SectionTitle kicker="Materials" title="Raw materials inventory" hint="Real-time stock with reservation tracking."
            right={<button onClick={() => setAddOpen(true)} className="btn-fire inline-flex items-center gap-1 px-4 py-2 text-sm"><Plus size={15} /> Add item</button>} />
          {stocks.length === 0 ? <Empty icon="📦" title="No stock items" hint="Add your first material above." /> : (
            <div className="space-y-1.5">
              {stocks.map((s) => {
                const health = stockHealth(s);
                return (
                  <div key={s.id} className="card flex items-center gap-3 p-3">
                    <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg",
                      health === "ok" ? "bg-emerald-50" : health === "low" ? "bg-amber-50" : "bg-red-50")}>
                      {health === "ok" ? "✅" : health === "low" ? "⚠️" : "🔴"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{s.name}</p>
                      <p className="text-xs text-[#7c8091]">{fmtQty(s.quantity, s.unit)} · Reserved {fmtQty(s.reserved, s.unit)} · Available {fmtQty(s.available, s.unit)}</p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button onClick={() => setEditItem(s)} className="btn-ghost grid h-8 w-8 place-items-center" title="Adjust"><Pencil size={14} /></button>
                      <button onClick={async () => { if (confirm(`Delete "${s.name}"?`)) await deleteStockItem(s.id); }}
                        className="grid h-8 w-8 place-items-center rounded-xl border border-red-200 bg-red-50 text-red-500" title="Delete"><Trash2 size={14} /></button>
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
          <SectionTitle kicker="History" title="Stock movements" hint="Every reserve / consume / adjust action." />
          {movements.length === 0 ? <Empty icon="🔄" title="No movements yet" hint="Activity will appear here once production starts." /> : (
            <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
              {movements.map((m) => (
                <div key={m.id} className="card flex items-center gap-3 p-3 text-sm">
                  <span className={cn("rounded-lg px-2 py-0.5 text-xs font-black",
                    m.movement_type === "consume" ? "bg-red-50 text-red-500" :
                    m.movement_type === "reserve" ? "bg-amber-50 text-amber-600" :
                    m.movement_type === "adjust" ? "bg-[#2f6eb5]/10 text-[#2f6eb5]" : "bg-[#4a7c59]/10 text-[#4a7c59]")}>
                    {m.movement_type.toUpperCase()}
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
          <SectionTitle kicker="Ready" title="Semi-finished products" hint="Items completed and awaiting admin release to MOBILIX." />
          {semiStock.length === 0 ? <Empty icon="🏗️" title="No semi-finished products" hint="Complete all steps to see items here." /> : (
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
  const [f, setF] = useState({ name: "", unit: "pcs", quantity: 0, alert_threshold: 10 });
  const [busy, setBusy] = useState(false);
  return (
    <form className="card w-full max-w-md space-y-3 p-6" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); await addStockItem(f.name, f.unit, f.quantity, f.alert_threshold); setBusy(false); onClose();
    }}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black">Add stock item</h3>
        <button type="button" onClick={onClose} className="btn-ghost grid h-8 w-8 place-items-center"><X size={16} /></button>
      </div>
      <input required placeholder="Material name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="input w-full px-4 py-2.5 text-sm" />
      <div className="grid grid-cols-3 gap-2">
        <select value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} className="input px-2 py-2.5 text-sm">
          {["pcs", "m", "m²", "kg", "L", "pcs"].map((u) => <option key={u} value={u} className="bg-white">{u}</option>)}
        </select>
        <input type="number" step="any" min={0} value={f.quantity} onChange={(e) => setF({ ...f, quantity: Number(e.target.value) })}
          className="input px-2 py-2.5 text-sm" placeholder="Qty" />
        <input type="number" step="any" min={0} value={f.alert_threshold} onChange={(e) => setF({ ...f, alert_threshold: Number(e.target.value) })}
          className="input px-2 py-2.5 text-sm" placeholder="Alert at" />
      </div>
      <button disabled={busy} className="btn-fire w-full px-4 py-2.5 text-sm">{busy ? "…" : "Add item"}</button>
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
        <h3 className="text-lg font-black">Adjust: {item.name}</h3>
        <button type="button" onClick={onClose} className="btn-ghost grid h-8 w-8 place-items-center"><X size={16} /></button>
      </div>
      <p className="text-sm text-[#7c8091]">Current: {fmtQty(item.quantity, item.unit)}</p>
      <input type="number" step="any" min={0} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="input w-full px-4 py-3 text-lg font-bold" />
      <input placeholder="Adjustment reason (optional)" value={note} onChange={(e) => setNote(e.target.value)} className="input w-full px-4 py-2.5 text-sm" />
      <button disabled={busy} className="btn-fire w-full px-4 py-2.5 text-sm">{busy ? "…" : "Save adjustment"}</button>
    </form>
  );
}
