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
    return Array.from(map.entries()).map(([material, qty]) => ({ material, qty: +qty.toFixed(2) }));
  }, [items, templates]);

  return (
    <div className="stagger space-y-5">
      <GlassCard>
        <SectionTitle kicker="Commande" title="Informations générales" />
        <div className="grid grid-cols-2 gap-3">
          <input required placeholder="N° commande — ex. WO-2026-042" value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)} className="input col-span-2 px-4 py-2.5 text-sm" />
          <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)}
            className="input px-4 py-2.5 text-sm" />
        </div>
      </GlassCard>

      <GlassCard>
        <SectionTitle kicker="Produits" title="Articles de la commande" hint="Chaque article a son produit, sa quantité, ses dimensions et son design."
          right={<button onClick={addItem} className="btn-fire inline-flex items-center gap-1 px-3 py-2 text-sm"><Plus size={15} /> Ajouter un article</button>} />
        <div className="space-y-4">
          {items.map((item, i) => (
            <div key={i} className="card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-[#c24a08]">ARTICLE #{i + 1}</span>
                {items.length > 1 && (
                  <button onClick={() => removeItem(i)} className="grid h-7 w-7 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-500"><Trash2 size={13} /></button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <input required placeholder="Nom du produit — ex. Chaise Maïa" value={item.productName}
                  onChange={(e) => updateItem(i, "productName", e.target.value)}
                  className="input col-span-2 px-3 py-2.5 text-sm" />
                <select value={item.categoryId} onChange={(e) => updateItem(i, "categoryId", e.target.value)}
                  className="input px-3 py-2.5 text-sm">
                  {categories.map((c) => <option key={c.id} value={c.id} className="bg-white">{c.name}</option>)}
                </select>
                <input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(i, "quantity", Number(e.target.value))}
                  className="input px-3 py-2.5 text-sm" placeholder="Quantité" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input placeholder="Longueur (cm)" value={item.length} onChange={(e) => updateItem(i, "length", e.target.value)} className="input px-3 py-2 text-sm" />
                <input placeholder="Largeur (cm)" value={item.width} onChange={(e) => updateItem(i, "width", e.target.value)} className="input px-3 py-2 text-sm" />
                <input placeholder="Hauteur (cm)" value={item.height} onChange={(e) => updateItem(i, "height", e.target.value)} className="input px-3 py-2 text-sm" />
              </div>
              <input placeholder="Notes design — ex. Style moderne, finition noire mate, accents dorés" value={item.designNotes}
                onChange={(e) => updateItem(i, "designNotes", e.target.value)} className="input w-full px-3 py-2 text-sm" />
            </div>
          ))}
        </div>
      </GlassCard>

      {totalEstimates.length > 0 && (
        <GlassCard className="border-[#c24a08]/25 bg-[#c24a08]/5">
          <SectionTitle kicker="Estimation auto" title="Résumé des réservations matière" hint="Ces quantités seront RÉSERVÉES du stock à la création de la commande." />
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {totalEstimates.map((e) => (
              <div key={e.material} className="card px-3 py-2 text-sm">
                <p className="font-bold">{e.material}</p>
                <p className="text-[#c24a08] font-mono">{e.qty}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-500">{error}</p>}

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
        <Package size={18} /> {busy ? "Création…" : "Créer la commande et réserver le stock"}
      </button>
    </div>
  );
}
