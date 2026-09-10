"use client";
import { useState } from "react";
import { Plus, IdCard } from "lucide-react";
import { GlassCard, SectionTitle, Empty } from "@/components/admin/ui";
import { ajouterEmploye } from "@/app/actions-erp";
import { atelierNom } from "@/lib/ateliers";

export default function PageClient({ employes }: { employes: any[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="stagger space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="card flex items-center gap-3 p-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#4a7c59]/10 text-[#4a7c59]"><IdCard size={20} /></span>
          <div><p className="text-2xl font-black">{employes.length}</p><p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Employés</p></div>
        </div>
        <div className="card p-4"><p className="text-2xl font-black">{employes.filter((e) => e.atelier_id === 1).length}</p><p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Atelier 1</p></div>
        <div className="card p-4"><p className="text-2xl font-black">{employes.filter((e) => e.atelier_id === 2).length}</p><p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Atelier 2</p></div>
      </div>
      <GlassCard>
        <SectionTitle kicker="RH" title="Employés" hint="Matricule, nom, poste, atelier, embauche."
          right={<button onClick={() => setOpen(true)} className="btn-fire inline-flex items-center gap-1 px-4 py-2 text-sm"><Plus size={15} /> Ajouter</button>} />
        {employes.length === 0 ? <Empty icon="👷" title="Aucun employé" hint="Importez HRM_Employee ou ajoutez un employé." /> : (
          <div className="space-y-1.5">
            {employes.map((e) => (
              <div key={e.id} className="card flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{e.nom} {e.prenom}</p>
                  <p className="text-xs text-[#7c8091]">{e.matricule} · {e.poste || "—"} · {atelierNom(e.atelier_id)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={() => setOpen(false)}>
          <form onClick={(e) => e.stopPropagation()} action={async (fd) => { await ajouterEmploye(fd); setOpen(false); }} className="card w-full max-w-lg space-y-3 p-5">
            <h3 className="text-lg font-extrabold">Nouvel employé</h3>
            <div className="grid grid-cols-2 gap-2">
              <input name="matricule" placeholder="Matricule" className="input" required />
              <input name="poste" placeholder="Poste" className="input" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input name="nom" placeholder="Nom" className="input" required />
              <input name="prenom" placeholder="Prénom" className="input" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select name="atelier_id" className="input" defaultValue="1">
                <option value="1">Atelier 1 — Bois & Découpe</option>
                <option value="2">Atelier 2 — Assemblage & Finition</option>
              </select>
              <input name="date_embauche" type="date" className="input" />
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
