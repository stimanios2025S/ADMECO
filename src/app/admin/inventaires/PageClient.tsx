"use client";
import { useState } from "react";
import { Plus, ClipboardCheck } from "lucide-react";
import { GlassCard, SectionTitle, Empty } from "@/components/admin/ui";
import { ajouterInventaire } from "@/app/actions-erp";
import { cn } from "@/lib/utils";

export default function PageClient({ inv, articles, depots }: { inv: any[]; articles: any[]; depots: any[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="stagger space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="card flex items-center gap-3 p-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#4a7c59]/10 text-[#4a7c59]"><ClipboardCheck size={20} /></span>
          <div><p className="text-2xl font-black">{inv.length}</p><p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Lignes</p></div>
        </div>
        <div className="card p-4"><p className="text-2xl font-black">{inv.filter((i) => Number(i.quantite_comptee) !== Number(i.quantite_theorique)).length}</p><p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Écarts</p></div>
        <div className="card p-4"><p className="text-2xl font-black">{depots.length}</p><p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Dépôts</p></div>
      </div>
      <GlassCard>
        <SectionTitle kicker="Comptage" title="Inventaires" hint="Dépôt, article, théorique, compté, écart."
          right={<button onClick={() => setOpen(true)} className="btn-fire inline-flex items-center gap-1 px-4 py-2 text-sm"><Plus size={15} /> Ajouter</button>} />
        {inv.length === 0 ? <Empty icon="📋" title="Aucun inventaire" hint="Importez COM_Inventory ou saisissez un comptage." /> : (
          <div className="space-y-1.5">
            {inv.map((i) => {
              const ecart = Number(i.quantite_comptee ?? 0) - Number(i.quantite_theorique ?? 0);
              return (
                <div key={i.id} className="card flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{(i as any).erp_articles?.designation ?? "—"}</p>
                    <p className="text-xs text-[#7c8091]">{(i as any).erp_depots?.nom ?? "—"} · {i.date_inventaire}</p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="text-[#7c8091]">Théo {Number(i.quantite_theorique ?? 0).toLocaleString()} · Compté {Number(i.quantite_comptee ?? 0).toLocaleString()}</p>
                    <p className={cn("font-black", ecart === 0 ? "text-[#4a7c59]" : "text-red-500")}>Écart {ecart.toLocaleString()}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={() => setOpen(false)}>
          <form onClick={(e) => e.stopPropagation()} action={async (fd) => { await ajouterInventaire(fd); setOpen(false); }} className="card w-full max-w-lg space-y-3 p-5">
            <h3 className="text-lg font-extrabold">Nouvelle ligne d'inventaire</h3>
            <div className="grid grid-cols-2 gap-2">
              <select name="depot_id" className="input" defaultValue="">
                <option value="">Dépôt…</option>
                {depots.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
              </select>
              <select name="article_id" className="input" defaultValue="">
                <option value="">Article…</option>
                {articles.map((a) => <option key={a.id} value={a.id}>{a.designation}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input name="quantite_theorique" type="number" step="0.001" placeholder="Théorique" className="input" />
              <input name="quantite_comptee" type="number" step="0.001" placeholder="Compté" className="input" />
              <input name="date_inventaire" type="date" className="input" />
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
