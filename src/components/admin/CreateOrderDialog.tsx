"use client";
import { useState } from "react";
import { createWorkOrder } from "@/app/actions";

export default function CreateOrderDialog({ categories }: { categories: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ orderNumber: "", categoryId: categories[0]?.id ?? "", targetQuantity: 50, dueAt: "" });

  if (!open) return <button onClick={() => setOpen(true)} className="rounded-xl bg-yellow-400 px-5 py-2.5 font-black text-black">+ New work order</button>;
  return (
    <form
      className="rounded-2xl bg-zinc-900 border border-zinc-700 p-4 space-y-3 text-white"
      onSubmit={async (e) => {
        e.preventDefault(); setBusy(true);
        try { await createWorkOrder(f); setOpen(false); } catch (err: any) { alert(err.message); }
        setBusy(false);
      }}
    >
      <div className="font-black text-lg">New work order (auto-instances template)</div>
      <input required placeholder="Order number e.g. WO-2026-001" value={f.orderNumber}
        onChange={(e) => setF({ ...f, orderNumber: e.target.value })}
        className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-2" />
      <div className="grid grid-cols-2 gap-2">
        <select value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}
          className="rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2">
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="number" min={1} value={f.targetQuantity}
          onChange={(e) => setF({ ...f, targetQuantity: Number(e.target.value) })}
          className="rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2" />
      </div>
      <input type="date" value={f.dueAt} onChange={(e) => setF({ ...f, dueAt: e.target.value })}
        className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-2" />
      <div className="flex gap-2">
        <button disabled={busy} className="rounded-xl bg-yellow-400 px-5 py-2 font-black text-black">Generate</button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-xl bg-zinc-700 px-4 py-2">Cancel</button>
      </div>
    </form>
  );
}
