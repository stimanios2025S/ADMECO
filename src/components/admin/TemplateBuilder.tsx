"use client";
import { useState } from "react";
import { saveTemplateStep, cloneTemplate } from "@/app/actions";

export type TRow = {
  id: string; category_id: string; step_order: number; atelier_id: number;
  step_name: string; estimated_minutes: number; standard_material: string; standard_qty: number;
};

export default function TemplateBuilder({ categories, rows }: { categories: { id: string; name: string }[]; rows: TRow[] }) {
  const [cat, setCat] = useState(categories[0]?.id ?? "");
  const [cloneFrom, setCloneFrom] = useState("");
  const [draft, setDraft] = useState({ step_order: (rows.filter((r) => r.category_id === cat).length || 0) + 1, atelier_id: 1, step_name: "", estimated_minutes: 30, standard_material: "", standard_qty: 0 });
  const list = rows.filter((r) => r.category_id === cat).sort((a, b) => a.step_order - b.step_order);

  return (
    <div className="space-y-4 text-white">
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <button key={c.id} onClick={() => setCat(c.id)}
            className={`rounded-xl px-4 py-2 font-bold ${cat === c.id ? "bg-yellow-400 text-black" : "bg-zinc-800"}`}>{c.name}</button>
        ))}
      </div>
      <div className="flex gap-2 items-center text-sm">
        <span className="text-zinc-400">Clone from:</span>
        <select value={cloneFrom} onChange={(e) => setCloneFrom(e.target.value)} className="rounded-lg bg-zinc-800 border border-zinc-700 px-2 py-1">
          <option value="">—</option>
          {categories.filter((c) => c.id !== cat).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button disabled={!cloneFrom} onClick={() => cloneTemplate(cat, cloneFrom)} className="rounded-lg bg-zinc-700 px-3 py-1 font-bold">Clone</button>
      </div>
      <div className="space-y-1">
        {list.map((r) => (
          <div key={r.id} className="flex items-center gap-2 rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm">
            <span className="font-mono text-yellow-300 w-8">#{r.step_order}</span>
            <span className="rounded bg-zinc-700 px-1.5 text-xs">A{r.atelier_id}</span>
            <span className="flex-1">{r.step_name}</span>
            <span className="text-zinc-400">{r.estimated_minutes} min</span>
          </div>
        ))}
      </div>
      <form
        className="rounded-2xl bg-zinc-900 border border-zinc-700 p-3 grid grid-cols-2 md:grid-cols-6 gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          await saveTemplateStep({ category_id: cat, ...draft });
          setDraft({ ...draft, step_order: draft.step_order + 1, step_name: "" });
        }}
      >
        <input type="number" min={1} value={draft.step_order} onChange={(e) => setDraft({ ...draft, step_order: Number(e.target.value) })}
          className="rounded-lg bg-zinc-800 border border-zinc-700 px-2 py-2" title="Order" />
        <select value={draft.atelier_id} onChange={(e) => setDraft({ ...draft, atelier_id: Number(e.target.value) })}
          className="rounded-lg bg-zinc-800 border border-zinc-700 px-2 py-2">
          <option value={1}>Atelier 1</option><option value={2}>Atelier 2</option><option value={3}>Atelier 3</option>
        </select>
        <input required placeholder="Step name" value={draft.step_name} onChange={(e) => setDraft({ ...draft, step_name: e.target.value })}
          className="rounded-lg bg-zinc-800 border border-zinc-700 px-2 py-2 col-span-2" />
        <input type="number" min={1} value={draft.estimated_minutes} onChange={(e) => setDraft({ ...draft, estimated_minutes: Number(e.target.value) })}
          className="rounded-lg bg-zinc-800 border border-zinc-700 px-2 py-2" title="Minutes" />
        <button className="rounded-lg bg-yellow-400 text-black font-black">+ Add</button>
      </form>
    </div>
  );
}
