"use client";
import { useMemo, useState } from "react";
import { Plus, Search, Factory } from "lucide-react";
import { GlassCard, SectionTitle, Empty } from "@/components/admin/ui";
import { ajouterFabrication } from "@/app/actions-erp";
import { atelierNom } from "@/lib/ateliers";
import { cn } from "@/lib/utils";

const STATUTS = [
  { id: "", nom: "Tous" },
  { id: "en_cours", nom: "En cours" },
  { id: "termine", nom: "Terminés" },
  { id: "suspendu", nom: "Suspendus" },
  { id: "annule", nom: "Annulés" },
];

export default function PageClient({ ordres, articles }: { ordres: any[]; articles: any[] }) {
  const [q, setQ] = useState("");
  const [statut, setStatut] = useState("");
  const [open, setOpen] = useState(false);
  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return ordres.filter((o) => (!statut || o.statut === statut) && (!n || `${o.numero} ${(o as any).erp_articles?.designation ?? ""}`.toLowerCase().includes(n)));
  }, [ordres, q, statut]);

  return (
    <div className="stagger space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card flex items-center gap-3 p-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#4a7c59]/10 text-[#4a7c59]"><Factory size={20} /></span>
          <div><p className="text-2xl font-black">{ordres.length}</p><p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Ordres</p></div>
        </div>
        <div className="card p-4"><p className="text-2xl font-black">{ordres.filter((o) => o.statut === "en_cours").length}</p><p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">En cours</p></div>
        <div className="card p-4"><p className="text-2xl font-black">{ordres.filter((o) => o.atelier_id === 1).length}</p><p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Atelier 1</p></div>
        <div className="card p-4"><p className="text-2xl font-black">{ordres.filter((o) => o.atelier_id === 2).length}</p><p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Atelier 2</p></div>
      </div>
      <GlassCard>
        <SectionTitle kicker="Production" title="Ordres de fabrication" hint="Numéro, article, quantités prévue / bonne / rebut, atelier, dates."
          right={<button onClick={() => setOpen(true)} className="btn-fire inline-flex items-center gap-1 px-4 py-2 text-sm"><Plus size={15} /> Ajouter</button>} />
        <div className="mb-3 flex flex-wrap gap-2">
          <label className="flex flex-1 min-w-[220px] items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2">
            <Search size={15} className="text-[#7c8091]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="N°, article…" className="w-full bg-transparent text-sm outline-none" />
          </label>
          <div className="flex gap-1.5">
            {STATUTS.map((s) => (
              <button key={s.id} onClick={() => setStatut(s.id)} className={cn("rounded-xl border px-3 py-2 text-xs font-bold", statut === s.id ? "border-[#4a7c59]/30 bg-[#4a7c59]/10 text-[#4a7c59]" : "border-black/8 text-[#7c8091]")}>{s.nom}</button>
            ))}
          </div>
        </div>
        {rows.length === 0 ? <Empty icon="🏭" title="Aucun ordre" hint="Importez Prod_Production ou créez un ordre." /> : (
          <div className="space-y-1.5">
            {rows.map((o) => (
              <div key={o.id} className="card flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{o.numero} — {(o as any).erp_articles?.designation ?? "—"}</p>
                  <p className="text-xs text-[#7c8091]">{atelierNom(o.atelier_id)} · {o.date_debut}{o.date_fin ? ` → ${o.date_fin}` : ""} · {o.statut}</p>
                </div>
                <div className="text-right text-xs">
                  <p className="font-black">Prévu {Number(o.quantite_prevue ?? 0).toLocaleString()}</p>
                  <p className="text-[#7c8091]">Bons {Number(o.quantite_bonne ?? 0).toLocaleString()} · Rebut {Number(o.quantite_rebut ?? 0).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={() => setOpen(false)}>
          <form onClick={(e) => e.stopPropagation()} action={async (fd) => { await ajouterFabrication(fd); setOpen(false); }} className="card w-full max-w-lg space-y-3 p-5">
            <h3 className="text-lg font-extrabold">Nouvel ordre de fabrication</h3>
            <div className="grid grid-cols-2 gap-2">
              <input name="numero" placeholder="N° ordre" className="input" required />
              <select name="atelier_id" className="input" defaultValue="1">
                <option value="1">Atelier 1 — Bois & Découpe</option>
                <option value="2">Atelier 2 — Assemblage & Finition</option>
              </select>
            </div>
            <select name="article_id" className="input" defaultValue="">
              <option value="">Article…</option>
              {articles.map((a) => <option key={a.id} value={a.id}>{a.designation} ({a.code})</option>)}
            </select>
            <div className="grid grid-cols-3 gap-2">
              <input name="quantite_prevue" type="number" step="0.001" placeholder="Qté prévue" className="input" />
              <input name="date_debut" type="date" className="input" />
              <input name="date_fin" type="date" className="input" />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost px-4 py-2 text-sm">Annuler</button>
              <button className="btn-fire px-4 py-2 text-sm">Enregistrer</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
