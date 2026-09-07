"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Package } from "lucide-react";
import { GlassCard, SectionTitle } from "@/components/admin/ui";
import { createOrder } from "@/app/actions";

type Item = { productName: string; categoryId: string; quantity: number; length: string; width: string; height: string; designNotes: string };

export default function NewOrderClient({ categories, templates }: { categories: { id: string; name: string }[]; templates: any[] }) {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState(`WO-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`);
  const [dueAt, setDueAt] = useState("");
  const [items, setItems] = useState<Item[]>([{ productName: "", categoryId: categories[0]?.id ?? "", quantity: 1, length: "", width: "", height: "", designNotes: "" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const updateItem = (i: number, key: keyof Item, val: any) => setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, [key]: val } : it));
  const addItem = () => setItems((prev) => [...prev, { productName: "", categoryId: categories[0]?.id ?? "", quantity: 1, length: "", width: "", height: "", designNotes: "" }]);
  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));

  const totalEstimates = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      const tpls = templates.filter((t) => t.category_id === item.categoryId);
      for (const t of tpls) {
        for (const m of (t.standard_materials ?? []) as any[]) {
          const key = m.material;
          map.set(key, (map.get(key) ?? 0) + m.qty * item.quantity);
        }
      }
    }
    return [...map.entries()].map(([material, qty]) => ({ material, qty: +qty.toFixed(2) }));
  }, [items, templates]);

  return (
    <div className="stagger space-y-5">
      <GlassCard>
        <SectionTitle kicker="Order" title="General information" />
        <div className="grid grid-cols-2 gap-3">
          <input required placeholder="Order number — e.g. WO-2026-042" value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)} className="glass-input col-span-2 px-4 py-2.5 text-sm" />
          <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)}
            className="glass-input px-4 py-2.5 text-sm" />
        </div>
      </GlassCard>

      <GlassCard>
        <SectionTitle kicker="Products" title="Order items" hint="Each item has its own product, quantity, dimensions and design."
          right={<button onClick={addItem} className="btn-fire inline-flex items-center gap-1 px-3 py-2 text-sm"><Plus size={15} /> Add item</button>} />
        <div className="space-y-4">
          {items.map((item, i) => (
            <div key={i} className="glass-soft p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-fire-soft">ITEM #{i + 1}</span>
                {items.length > 1 && (
                  <button onClick={() => removeItem(i)} className="grid h-7 w-7 place-items-center rounded-lg border border-red-400/25 bg-red-400/10 text-red-300"><Trash2 size={13} /></button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <input required placeholder="Product name — e.g. Chaise Maïa" value={item.productName}
                  onChange={(e) => updateItem(i, "productName", e.target.value)}
                  className="glass-input col-span-2 px-3 py-2.5 text-sm" />
                <select value={item.categoryId} onChange={(e) => updateItem(i, "categoryId", e.target.value)}
                  className="glass-input px-3 py-2.5 text-sm">
                  {categories.map((c) => <option key={c.id} value={c.id} className="bg-zinc-900">{c.name}</option>)}
                </select>
                <input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(i, "quantity", Number(e.target.value))}
                  className="glass-input px-3 py-2.5 text-sm" placeholder="Quantity" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input placeholder="Length (cm)" value={item.length} onChange={(e) => updateItem(i, "length", e.target.value)} className="glass-input px-3 py-2 text-sm" />
                <input placeholder="Width (cm)" value={item.width} onChange={(e) => updateItem(i, "width", e.target.value)} className="glass-input px-3 py-2 text-sm" />
                <input placeholder="Height (cm)" value={item.height} onChange={(e) => updateItem(i, "height", e.target.value)} className="glass-input px-3 py-2 text-sm" />
              </div>
              <input placeholder="Design notes — e.g. Style moderne, finition noire mate, accenty dorés" value={item.designNotes}
                onChange={(e) => updateItem(i, "designNotes", e.target.value)} className="glass-input w-full px-3 py-2 text-sm" />
            </div>
          ))}
        </div>
      </GlassCard>

      {totalEstimates.length > 0 && (
        <GlassCard className="border-fire/25 bg-gradient-to-r from-fire/5 to-transparent">
          <SectionTitle kicker="Auto-estimate" title="Material reservation summary" hint="These quantities will be RESERVED from stock when the order is created." />
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {totalEstimates.map((e) => (
              <div key={e.material} className="glass-soft px-3 py-2 text-sm">
                <p className="font-bold">{e.material}</p>
                <p className="text-fire-soft font-mono">{e.qty}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {error && <p className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2 text-sm text-red-300">{error}</p>}

      <button disabled={busy || items.every((i) => !i.productName.trim())} onClick={async () => {
        setBusy(true); setError("");
        try {
          await createOrder({
            orderNumber, dueAt, items: items.filter((i) => i.productName.trim()).map((i) => ({
              productName: i.productName, categoryId: i.categoryId, quantity: i.quantity,
              dimensions: { length: i.length, width: i.width, height: i.height }, designNotes: i.designNotes
            }))
          });
          router.push("/admin/orders");
        } catch (e: any) { setError(e.message); }
        setBusy(false);
      }} className="btn-fire inline-flex w-full items-center justify-center gap-2 px-6 py-3.5 text-sm font-black sm:w-auto">
        <Package size={18} /> {busy ? "Creating order…" : "Create order & reserve stock"}
      </button>
    </div>
  );
}
