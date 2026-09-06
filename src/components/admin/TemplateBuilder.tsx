"use client";
import { useState } from "react";
import { Plus, Copy } from "lucide-react";
import { saveTemplateStep, cloneTemplate } from "@/app/actions";
import { GlassCard, SectionTitle } from "./ui";
import { cn } from "@/lib/utils";

export type TRow = {
  id: string; category_id: string; step_order: number; atelier_id: number;
  step_name: string; estimated_minutes: number; standard_material: string; standard_qty: number;
};

export default function TemplateBuilder({ categories, rows }: { categories: { id: string; name: string }[]; rows: TRow[] }) {
  const [cat, setCat] = useState(categories[0]?.id ?? "");
  const [cloneFrom, setCloneFrom] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ step_order: 1, atelier_id: 1, step_name: "", estimated_minutes: 30, standard_material: "", standard_qty: 0 });
  const list = rows.filter((r) => r.category_id === cat).sort((a, b) => a.step_order - b.step_order);

  return (
    <div className="stagger space-y-5">
      <GlassCard>
        <SectionTitle kicker="Categories" title="Select product line" hint="Each category owns its own routing." />
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button key={c.id} onClick={() => { setCat(c.id); setDraft((d) => ({ ...d, step_order: rows.filter((r) => r.category_id === c.id).length + 1 })); }}
              className={cn("rounded-xl border px-4 py-2 text-sm font-bold transition",
                cat === c.id ? "border-fire/40 bg-fire/15 text-white shadow-fire" : "border-white/10 text-zinc-400 hover:text-white")}>
              {c.name}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs text-zinc-500">Clone routing from:</span>
          <select value={cloneFrom} onChange={(e) => setCloneFrom(e.target.value)} className="glass-input px-2 py-1.5 text-xs">
            <option value="" className="bg-zinc-900">—</option>
            {categories.filter((c) => c.id !== cat).map((c) => <option key={c.id} value={c.id} className="bg-zinc-900">{c.name}</option>)}
          </select>
          <button disabled={!cloneFrom || busy} onClick={async () => { setBusy(true); await cloneTemplate(cat, cloneFrom); setBusy(false); location.reload(); }}
            className="btn-ghost inline-flex items-center gap-1 px-3 py-1.5 text-xs">
            <Copy size={13} /> Clone
          </button>
        </div>
      </GlassCard>

      <GlassCard>
        <SectionTitle kicker={`Routing · ${list.length} steps`} title={categories.find((c) => c.id === cat)?.name ?? ""}
          hint="Ordered atelier sequence inherited by every new order." />
        <div className="space-y-1.5">
          {list.map((r) => (
            <div key={r.id} className="glass-soft flex items-center gap-2.5 px-3 py-2 text-sm">
              <span className="w-9 shrink-0 font-mono text-xs font-bold text-fire-soft">#{r.step_order}</span>
              <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-black",
                r.atelier_id === 1 ? "bg-fire/15 text-fire-soft" : r.atelier_id === 2 ? "bg-amber-400/15 text-amber-300" : "bg-ice/15 text-ice-soft")}>
                A{r.atelier_id}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{r.step_name}</span>
              <span className="hidden shrink-0 text-xs text-zinc-500 sm:block">{r.standard_material} {r.standard_qty ? `×${r.standard_qty}` : ""}</span>
              <span className="shrink-0 font-mono text-xs text-zinc-400">{r.estimated_minutes}m</span>
            </div>
          ))}
          {list.length === 0 && <p className="text-sm text-zinc-500">No steps yet — add the first one below.</p>}
        </div>

        <form
          className="glass-soft mt-3 grid grid-cols-2 gap-2 p-3 md:grid-cols-6"
          onSubmit={async (e) => {
            e.preventDefault(); setBusy(true);
            await saveTemplateStep({ category_id: cat, ...draft });
            setDraft({ ...draft, step_order: draft.step_order + 1, step_name: "" });
            setBusy(false); location.reload();
          }}
        >
          <input type="number" min={1} value={draft.step_order} onChange={(e) => setDraft({ ...draft, step_order: Number(e.target.value) })}
            className="glass-input px-2 py-2 text-sm" title="Step order" />
          <select value={draft.atelier_id} onChange={(e) => setDraft({ ...draft, atelier_id: Number(e.target.value) })} className="glass-input px-2 py-2 text-sm">
            <option value={1} className="bg-zinc-900">Atelier 1</option>
            <option value={2} className="bg-zinc-900">Atelier 2</option>
            <option value={3} className="bg-zinc-900">Atelier 3</option>
          </select>
          <input required placeholder="Step name" value={draft.step_name} onChange={(e) => setDraft({ ...draft, step_name: e.target.value })}
            className="glass-input col-span-2 px-2 py-2 text-sm" />
          <input type="number" min={1} value={draft.estimated_minutes} onChange={(e) => setDraft({ ...draft, estimated_minutes: Number(e.target.value) })}
            className="glass-input px-2 py-2 text-sm" title="Minutes" />
          <button disabled={busy} className="btn-fire inline-flex items-center justify-center gap-1 px-3 py-2 text-sm">
            <Plus size={15} /> Add
          </button>
        </form>
      </GlassCard>
    </div>
  );
}
