"use client";
import { useState } from "react";
import { Plus, Building2 } from "lucide-react";
import { GlassCard, SectionTitle, Empty } from "@/components/admin/ui";
import { ajouterDepot } from "@/app/actions-erp";
import { atelierNom } from "@/lib/ateliers";

export default function PageClient({ depots }: { depots: any[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="stagger space-y-5">
      <div className="card flex items-center gap-3 p-4">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#4a7c59]/10 text-[#4a7c59]"><Building2 size={20} /></span>
        <div><p className="text-2xl font-black">{depots.length}</p><p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Dépôts</p></div>
      </div>
      <GlassCard>
        <SectionTitle kicker="Logistique" title="Dépôts" hint="Code, nom, atelier, adresse."
          right={<button onClick={() => setOpen(true)} className="btn-fire inline-flex items-center gap-1 px-4 py-2 text-sm"><Plus size={15} /> Ajouter</button>} />
        {depots.length === 0 ? <Empty icon="🏬" title="Aucun dépôt" hint="Exécutez la migration 0009 ou ajoutez un dépôt." /> : (
          <div className="space-y-1.5">
            {depots.map((d) => (
              <div key={d.id} className="card flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{d.code} — {d.nom}</p>
                  <p className="text-xs text-[#7c8091]">{atelierNom(d.atelier_id)}{d.adresse ? ` · ${d.adresse}` : ""}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={() => setOpen(false)}>
          <form onClick={(e) => e.stopPropagation()} action={async (fd) => { await ajouterDepot(fd); setOpen(false); }} className="card w-full max-w-lg space-y-3 p-5">
            <h3 className="text-lg font-extrabold">Nouveau dépôt</h3>
            <div className="grid grid-cols-2 gap-2">
              <input name="code" placeholder="Code" className="input" required />
              <select name="atelier_id" className="input" defaultValue="1">
                <option value="1">Atelier 1 — Bois & Découpe</option>
                <option value="2">Atelier 2 — Assemblage & Finition</option>
              </select>
            </div>
            <input name="nom" placeholder="Nom" className="input" required />
            <input name="adresse" placeholder="Adresse" className="input" />
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
