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
        <SectionTitle kicker="Catégories" title="Choisir la gamme produit" hint="Chaque catégorie a sa propre gamme." />
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button key={c.id} onClick={() => { setCat(c.id); setDraft((d) => ({ ...d, step_order: rows.filter((r) => r.category_id === c.id).length + 1 })); }}
              className={cn("rounded-xl border px-4 py-2 text-sm font-bold transition",
                cat === c.id ? "border-[#c24a08]/40 bg-[#c24a08]/10 text-[#c24a08]" : "border-[#e6e1d8] text-[#7c8091] hover:text-[#1a1d23]")}>
              {c.name}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs text-[#7c8091]">Dupliquer la gamme depuis :</span>
          <select value={cloneFrom} onChange={(e) => setCloneFrom(e.target.value)} className="input px-2 py-1.5 text-xs">
            <option value="" className="bg-white">—</option>
            {categories.filter((c) => c.id !== cat).map((c) => <option key={c.id} value={c.id} className="bg-white">{c.name}</option>)}
          </select>
          <button disabled={!cloneFrom || busy} onClick={async () => { setBusy(true); await cloneTemplate(cat, cloneFrom); setBusy(false); location.reload(); }}
            className="btn-ghost inline-flex items-center gap-1 px-3 py-1.5 text-xs">
            <Copy size={13} /> Dupliquer
          </button>
        </div>
      </GlassCard>

      <GlassCard>
        <SectionTitle kicker={`Gamme · ${list.length} étapes`} title={categories.find((c) => c.id === cat)?.name ?? ""}
          hint="Séquence d'ateliers héritée par chaque nouvelle commande." />
        <div className="space-y-1.5">
          {list.map((r) => (
            <div key={r.id} className="card flex items-center gap-2.5 px-3 py-2 text-sm">
              <span className="w-9 shrink-0 font-mono text-xs font-bold text-[#c24a08]">#{r.step_order}</span>
              <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-black",
                r.atelier_id === 1 ? "bg-[#c24a08]/10 text-[#c24a08]" : r.atelier_id === 2 ? "bg-amber-50 text-amber-600" : "bg-[#2f6eb5]/10 text-[#2f6eb5]")}>
                A{r.atelier_id}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{r.step_name}</span>
              <span className="hidden shrink-0 text-xs text-[#7c8091] sm:block">{r.standard_material} {r.standard_qty ? `×${r.standard_qty}` : ""}</span>
              <span className="shrink-0 font-mono text-xs text-[#7c8091]">{r.estimated_minutes}m</span>
            </div>
          ))}
          {list.length === 0 && <p className="text-sm text-[#7c8091]">Aucune étape — ajoutez la première ci-dessous.</p>}
        </div>

        <form
          className="card mt-3 grid grid-cols-2 gap-2 p-3 md:grid-cols-6"
          onSubmit={async (e) => {
            e.preventDefault(); setBusy(true);
            await saveTemplateStep({ category_id: cat, ...draft });
            setDraft({ ...draft, step_order: draft.step_order + 1, step_name: "" });
            setBusy(false); location.reload();
          }}
        >
          <input type="number" min={1} value={draft.step_order} onChange={(e) => setDraft({ ...draft, step_order: Number(e.target.value) })}
            className="input px-2 py-2 text-sm" title="Ordre de l'étape" />
          <select value={draft.atelier_id} onChange={(e) => setDraft({ ...draft, atelier_id: Number(e.target.value) })} className="input px-2 py-2 text-sm">
            <option value={1} className="bg-white">Atelier 1</option>
            <option value={2} className="bg-white">Atelier 2</option>
          </select>
          <input required placeholder="Nom de l'étape" value={draft.step_name} onChange={(e) => setDraft({ ...draft, step_name: e.target.value })}
            className="input col-span-2 px-2 py-2 text-sm" />
          <input type="number" min={1} value={draft.estimated_minutes} onChange={(e) => setDraft({ ...draft, estimated_minutes: Number(e.target.value) })}
            className="input px-2 py-2 text-sm" title="Minutes" />
          <button disabled={busy} className="btn-fire inline-flex items-center justify-center gap-1 px-3 py-2 text-sm">
            <Plus size={15} /> Ajouter
          </button>
        </form>
      </GlassCard>
    </div>
  );
}
