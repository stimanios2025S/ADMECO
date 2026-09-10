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
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="card border-[#4a7c59]/20 p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#4a7c59]">DEP-MP — Matière Première</p>
          <p className="text-sm font-bold">Centrale, alimente A1 + A2 au début</p>
          <p className="text-xs text-[#7c8091]">Réservée à la création commande, retirée seulement au déclaré de chaque étape.</p>
        </div>
        <div className="card border-amber-200 p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-amber-600">DEP-A1 — Stock Atelier 1</p>
          <p className="text-sm font-bold">Ce que l'Atelier 1 a produit</p>
          <p className="text-xs text-[#7c8091]">Semi-finis A1 → transfert vers Atelier 2.</p>
        </div>
        <div className="card border-[#2f6eb5]/20 p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#2f6eb5]">DEP-A2 — Stock Atelier 2</p>
          <p className="text-sm font-bold">Ce que l'Atelier 2 a produit</p>
          <p className="text-xs text-[#7c8091]">Finis A2 → expédition.</p>
        </div>
      </div>
      <GlassCard>
        <SectionTitle kicker="Logistique" title="Dépôts" hint="DEP-MP centrale + DEP-A1 produit par A1 + DEP-A2 produit par A2."
          right={<button onClick={() => setOpen(true)} className="btn-fire inline-flex items-center gap-1 px-4 py-2 text-sm"><Plus size={15} /> Ajouter</button>} />
        {depots.length === 0 ? <Empty icon="🏬" title="Aucun dépôt" hint="Exécutez les migrations 0009 puis 0010, ou ajoutez un dépôt." /> : (
          <div className="space-y-1.5">
            {depots.map((d) => (
              <div key={d.id} className="card flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{d.code} — {d.nom}</p>
                  <p className="text-xs text-[#7c8091]">{d.atelier_id ? atelierNom(d.atelier_id) : "Commun A1 + A2 (centrale)"}{d.adresse ? ` · ${d.adresse}` : ""}</p>
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
