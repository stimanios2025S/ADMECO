"use client";
import { useState } from "react";
import { Plus, BookOpen } from "lucide-react";
import { GlassCard, SectionTitle, Empty } from "@/components/admin/ui";
import { ajouterEcriture } from "@/app/actions-erp";

export default function PageClient({ ecritures }: { ecritures: any[] }) {
  const [open, setOpen] = useState(false);
  const debit = ecritures.reduce((a, e) => a + Number(e.debit ?? 0), 0);
  const credit = ecritures.reduce((a, e) => a + Number(e.credit ?? 0), 0);
  return (
    <div className="stagger space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="card flex items-center gap-3 p-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#4a7c59]/10 text-[#4a7c59]"><BookOpen size={20} /></span>
          <div><p className="text-2xl font-black">{ecritures.length}</p><p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Écritures</p></div>
        </div>
        <div className="card p-4"><p className="text-2xl font-black">{debit.toLocaleString()}</p><p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Total débit</p></div>
        <div className="card p-4"><p className="text-2xl font-black">{credit.toLocaleString()}</p><p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Total crédit</p></div>
      </div>
      <GlassCard>
        <SectionTitle kicker="Comptes" title="Écritures" hint="Journal, date, compte, libellé, débit, crédit."
          right={<button onClick={() => setOpen(true)} className="btn-fire inline-flex items-center gap-1 px-4 py-2 text-sm"><Plus size={15} /> Ajouter</button>} />
        {ecritures.length === 0 ? <Empty icon="📒" title="Aucune écriture" hint="Importez ACC_Operation ou saisissez une écriture." /> : (
          <div className="space-y-1.5">
            {ecritures.map((e) => (
              <div key={e.id} className="card flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{e.numero || "—"} · {e.libelle || "—"}</p>
                  <p className="text-xs text-[#7c8091]">{e.journal || "—"} · {e.date_ecriture} · Compte {e.compte || "—"}</p>
                </div>
                <div className="text-right text-xs">
                  <p className="font-black">D {Number(e.debit ?? 0).toLocaleString()}</p>
                  <p className="text-[#7c8091]">C {Number(e.credit ?? 0).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={() => setOpen(false)}>
          <form onClick={(e) => e.stopPropagation()} action={async (fd) => { await ajouterEcriture(fd); setOpen(false); }} className="card w-full max-w-lg space-y-3 p-5">
            <h3 className="text-lg font-extrabold">Nouvelle écriture</h3>
            <div className="grid grid-cols-2 gap-2">
              <input name="numero" placeholder="N° pièce" className="input" />
              <input name="journal" placeholder="Journal" className="input" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input name="date_ecriture" type="date" className="input" />
              <input name="compte" placeholder="Compte" className="input" />
            </div>
            <input name="libelle" placeholder="Libellé" className="input" />
            <div className="grid grid-cols-2 gap-2">
              <input name="debit" type="number" step="0.01" placeholder="Débit" className="input" />
              <input name="credit" type="number" step="0.01" placeholder="Crédit" className="input" />
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
