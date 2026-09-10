"use client";
import { useMemo, useState } from "react";
import { Plus, Search, Handshake } from "lucide-react";
import { GlassCard, SectionTitle, Empty } from "@/components/admin/ui";
import { ajouterTiers } from "@/app/actions-erp";
import { cn } from "@/lib/utils";

const TYPES = [
  { id: "", nom: "Tous" },
  { id: "client", nom: "Clients" },
  { id: "fournisseur", nom: "Fournisseurs" },
  { id: "salarie", nom: "Salariés" },
  { id: "autre", nom: "Autres" },
];

export default function PageClient({ tiers }: { tiers: any[] }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [open, setOpen] = useState(false);
  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return tiers.filter((t) => (!type || t.type_tiers === type) && (!n || `${t.code} ${t.raison_sociale}`.toLowerCase().includes(n)));
  }, [tiers, q, type]);

  return (
    <div className="stagger space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card flex items-center gap-3 p-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#4a7c59]/10 text-[#4a7c59]"><Handshake size={20} /></span>
          <div><p className="text-2xl font-black">{tiers.length}</p><p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Tiers</p></div>
        </div>
        <div className="card p-4"><p className="text-2xl font-black">{tiers.filter((t) => t.type_tiers === "client").length}</p><p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Clients</p></div>
        <div className="card p-4"><p className="text-2xl font-black">{tiers.filter((t) => t.type_tiers === "fournisseur").length}</p><p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Fournisseurs</p></div>
        <div className="card p-4"><p className="text-2xl font-black">{tiers.filter((t) => !t.raison_sociale).length}</p><p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">À compléter</p></div>
      </div>
      <GlassCard>
        <SectionTitle kicker="Référentiel" title="Tiers ADMEDCO" hint="Raison sociale, type, téléphone, wilaya, NIF."
          right={<button onClick={() => setOpen(true)} className="btn-fire inline-flex items-center gap-1 px-4 py-2 text-sm"><Plus size={15} /> Ajouter</button>} />
        <div className="mb-3 flex flex-wrap gap-2">
          <label className="flex flex-1 min-w-[220px] items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2">
            <Search size={15} className="text-[#7c8091]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" className="w-full bg-transparent text-sm outline-none" />
          </label>
          <div className="flex gap-1.5">
            {TYPES.map((t) => (
              <button key={t.id} onClick={() => setType(t.id)} className={cn("rounded-xl border px-3 py-2 text-xs font-bold", type === t.id ? "border-[#4a7c59]/30 bg-[#4a7c59]/10 text-[#4a7c59]" : "border-black/8 text-[#7c8091]")}>{t.nom}</button>
            ))}
          </div>
        </div>
        {rows.length === 0 ? <Empty icon="🤝" title="Aucun tiers" hint="Importez COM_ThirdParty ou ajoutez un tiers." /> : (
          <div className="space-y-1.5">
            {rows.map((t) => (
              <div key={t.id} className="card flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{t.raison_sociale}</p>
                  <p className="text-xs text-[#7c8091]">{t.code || "—"} · {t.type_tiers} · {t.telephone || "—"} · {t.wilaya || "—"}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={() => setOpen(false)}>
          <form onClick={(e) => e.stopPropagation()} action={async (fd) => { await ajouterTiers(fd); setOpen(false); }} className="card w-full max-w-lg space-y-3 p-5">
            <h3 className="text-lg font-extrabold">Nouveau tiers</h3>
            <input name="raison_sociale" placeholder="Raison sociale" className="input" required />
            <div className="grid grid-cols-2 gap-2">
              <input name="code" placeholder="Code" className="input" />
              <select name="type_tiers" className="input" defaultValue="client">
                <option value="client">Client</option><option value="fournisseur">Fournisseur</option>
                <option value="salarie">Salarié</option><option value="autre">Autre</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input name="telephone" placeholder="Téléphone" className="input" />
              <input name="wilaya" placeholder="Wilaya" className="input" />
            </div>
            <input name="adresse" placeholder="Adresse" className="input" />
            <input name="nif" placeholder="NIF" className="input" />
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
