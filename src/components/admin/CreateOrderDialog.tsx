"use client";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { createWorkOrder } from "@/app/actions";

export default function CreateOrderDialog({ categories }: { categories: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ orderNumber: "", categoryId: categories[0]?.id ?? "", targetQuantity: 50, dueAt: "" });

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-fire inline-flex items-center gap-1.5 px-4 py-2 text-sm">
        <Plus size={16} /> Nouvelle commande
      </button>
    );
  }
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <form
        className="card relative w-full max-w-md space-y-3 p-6"
        onSubmit={async (e) => {
          e.preventDefault(); setBusy(true);
          try { await createWorkOrder(f); setOpen(false); location.reload(); }
          catch (err: any) { alert(err.message); }
          setBusy(false);
        }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black">Nouvelle commande</h3>
          <button type="button" onClick={() => setOpen(false)} className="btn-ghost grid h-8 w-8 place-items-center"><X size={16} /></button>
        </div>
        <p className="text-xs text-[#7c8091]">Instancie automatiquement la gamme de la catégorie choisie.</p>
        <input required placeholder="N° commande — ex. WO-2026-001" value={f.orderNumber}
          onChange={(e) => setF({ ...f, orderNumber: e.target.value })} className="input w-full px-4 py-2.5 text-sm" />
        <div className="grid grid-cols-2 gap-2">
          <select value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })} className="input px-3 py-2.5 text-sm">
            {categories.map((c) => <option key={c.id} value={c.id} className="bg-white">{c.name}</option>)}
          </select>
          <input type="number" min={1} value={f.targetQuantity} title="Quantité cible"
            onChange={(e) => setF({ ...f, targetQuantity: Number(e.target.value) })} className="input px-3 py-2.5 text-sm" />
        </div>
        <input type="date" value={f.dueAt} onChange={(e) => setF({ ...f, dueAt: e.target.value })} className="input w-full px-4 py-2.5 text-sm" />
        <div className="flex gap-2 pt-1">
          <button disabled={busy} className="btn-fire flex-1 px-5 py-2.5 text-sm">{busy ? "Génération…" : "Générer la commande"}</button>
          <button type="button" onClick={() => setOpen(false)} className="btn-ghost px-4 py-2.5 text-sm">Annuler</button>
        </div>
      </form>
    </div>
  );
}
