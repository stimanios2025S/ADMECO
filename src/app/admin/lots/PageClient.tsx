"use client";
import { useState } from "react";
import { Plus, Layers } from "lucide-react";
import { GlassCard, SectionTitle, Empty } from "@/components/admin/ui";
import { ajouterLot } from "@/app/actions-erp";

export default function PageClient({ lots, articles, depots }: { lots: any[]; articles: any[]; depots: any[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="stagger space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="card flex items-center gap-3 p-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#4a7c59]/10 text-[#4a7c59]"><Layers size={20} /></span>
          <div><p className="text-2xl font-black">{lots.length}</p><p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Lots</p></div>
        </div>
        <div className="card p-4"><p className="text-2xl font-black">{lots.reduce((a, l) => a + Number(l.quantite ?? 0), 0).toLocaleString()}</p><p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Quantité totale</p></div>
        <div className="card p-4"><p className="text-2xl font-black">{depots.length}</p><p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Dépôts</p></div>
      </div>
      <GlassCard>
        <SectionTitle kicker="Traçabilité" title="Lots ADMEDCO" hint="Numéro de lot, article, dépôt, quantité, expiration."
          right={<button onClick={() => setOpen(true)} className="btn-fire inline-flex items-center gap-1 px-4 py-2 text-sm"><Plus size={15} /> Ajouter</button>} />
        {lots.length === 0 ? <Empty icon="🏷️" title="Aucun lot" hint="Importez COM_Batch ou créez un lot." /> : (
          <div className="space-y-1.5">
            {lots.map((l) => (
              <div key={l.id} className="card flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{l.numero_lot || "Sans n°"} — {(l as any).erp_articles?.designation ?? "—"}</p>
                  <p className="text-xs text-[#7c8091]">{(l as any).erp_depots?.nom ?? "—"}{l.date_expiration ? ` · Expire ${l.date_expiration}` : ""}</p>
                </div>
                <p className="text-sm font-black">{Number(l.quantite ?? 0).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={() => setOpen(false)}>
          <form onClick={(e) => e.stopPropagation()} action={async (fd) => { await ajouterLot(fd); setOpen(false); }} className="card w-full max-w-lg space-y-3 p-5">
            <h3 className="text-lg font-extrabold">Nouveau lot</h3>
            <input name="numero_lot" placeholder="N° lot" className="input" required />
            <select name="article_id" className="input" defaultValue="">
              <option value="">Article…</option>
              {articles.map((a) => <option key={a.id} value={a.id}>{a.designation}</option>)}
            </select>
            <select name="depot_id" className="input" defaultValue="">
              <option value="">Dépôt…</option>
              {depots.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input name="quantite" type="number" step="0.001" placeholder="Quantité" className="input" />
              <input name="date_expiration" type="date" className="input" />
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
