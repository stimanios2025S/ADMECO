"use client";
import { useState } from "react";
import { Plus, Cog } from "lucide-react";
import { GlassCard, SectionTitle, Empty } from "@/components/admin/ui";
import { ajouterMachine } from "@/app/actions-erp";
import { atelierNom } from "@/lib/ateliers";
import { cn } from "@/lib/utils";

export default function PageClient({ machines }: { machines: any[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="stagger space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card flex items-center gap-3 p-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#4a7c59]/10 text-[#4a7c59]"><Cog size={20} /></span>
          <div><p className="text-2xl font-black">{machines.length}</p><p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Machines</p></div>
        </div>
        <div className="card p-4"><p className="text-2xl font-black">{machines.filter((m) => m.statut === "active").length}</p><p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Actives</p></div>
        <div className="card p-4"><p className="text-2xl font-black">{machines.filter((m) => m.atelier_id === 1).length}</p><p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Atelier 1</p></div>
        <div className="card p-4"><p className="text-2xl font-black">{machines.filter((m) => m.atelier_id === 2).length}</p><p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Atelier 2</p></div>
      </div>
      <GlassCard>
        <SectionTitle kicker="Parc" title="Machines" hint="Code, nom, famille, atelier, statut."
          right={<button onClick={() => setOpen(true)} className="btn-fire inline-flex items-center gap-1 px-4 py-2 text-sm"><Plus size={15} /> Ajouter</button>} />
        {machines.length === 0 ? <Empty icon="⚙️" title="Aucune machine" hint="Importez Prod_Machine ou ajoutez une machine." /> : (
          <div className="space-y-1.5">
            {machines.map((m) => (
              <div key={m.id} className="card flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{m.code} — {m.nom}</p>
                  <p className="text-xs text-[#7c8091]">{m.famille || "—"} · {atelierNom(m.atelier_id)}</p>
                </div>
                <span className={cn("rounded-lg px-2 py-1 text-[11px] font-bold", m.statut === "active" ? "bg-[#4a7c59]/10 text-[#4a7c59]" : "bg-red-50 text-red-500")}>{m.statut}</span>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={() => setOpen(false)}>
          <form onClick={(e) => e.stopPropagation()} action={async (fd) => { await ajouterMachine(fd); setOpen(false); }} className="card w-full max-w-lg space-y-3 p-5">
            <h3 className="text-lg font-extrabold">Nouvelle machine</h3>
            <div className="grid grid-cols-2 gap-2">
              <input name="code" placeholder="Code" className="input" required />
              <input name="famille" placeholder="Famille" className="input" />
            </div>
            <input name="nom" placeholder="Nom" className="input" required />
            <select name="atelier_id" className="input" defaultValue="1">
              <option value="1">Atelier 1 — Bois & Découpe</option>
              <option value="2">Atelier 2 — Assemblage & Finition</option>
            </select>
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
