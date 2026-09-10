"use client";
import { useMemo, useState } from "react";
import { Plus, Search, FileText } from "lucide-react";
import { GlassCard, SectionTitle, Empty } from "@/components/admin/ui";
import { ajouterDocument } from "@/app/actions-erp";
import { cn } from "@/lib/utils";

const TYPES = ["devis", "commande_client", "commande_fournisseur", "facture", "bon_livraison", "bon_reception", "avoir"];
const TYPE_FR: Record<string, string> = {
  devis: "Devis", commande_client: "Commande client", commande_fournisseur: "Commande fournisseur",
  facture: "Facture", bon_livraison: "Bon de livraison", bon_reception: "Bon de réception", avoir: "Avoir",
};

export default function PageClient({ docs, tiers }: { docs: any[]; tiers: any[] }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [open, setOpen] = useState(false);
  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return docs.filter((d) => (!type || d.type_doc === type) && (!n || `${d.numero} ${(d as any).erp_tiers?.raison_sociale ?? ""}`.toLowerCase().includes(n)));
  }, [docs, q, type]);
  const total = rows.reduce((a, d) => a + Number(d.total_ttc ?? 0), 0);

  return (
    <div className="stagger space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card flex items-center gap-3 p-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#4a7c59]/10 text-[#4a7c59]"><FileText size={20} /></span>
          <div><p className="text-2xl font-black">{docs.length}</p><p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Documents</p></div>
        </div>
        <div className="card p-4"><p className="text-2xl font-black">{total.toLocaleString()}</p><p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Total TTC filtré</p></div>
        <div className="card p-4"><p className="text-2xl font-black">{docs.filter((d) => d.statut === "valide").length}</p><p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Validés</p></div>
        <div className="card p-4"><p className="text-2xl font-black">{docs.filter((d) => d.statut === "brouillon").length}</p><p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Brouillons</p></div>
      </div>
      <GlassCard>
        <SectionTitle kicker="Gestion" title="Documents commerciaux" hint="Numéro, type, tiers, date, totaux, statut."
          right={<button onClick={() => setOpen(true)} className="btn-fire inline-flex items-center gap-1 px-4 py-2 text-sm"><Plus size={15} /> Ajouter</button>} />
        <div className="mb-3 flex flex-wrap gap-2">
          <label className="flex flex-1 min-w-[220px] items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2">
            <Search size={15} className="text-[#7c8091]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="N°, tiers…" className="w-full bg-transparent text-sm outline-none" />
          </label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="input max-w-[240px]">
            <option value="">Tous types</option>
            {TYPES.map((t) => <option key={t} value={t}>{TYPE_FR[t]}</option>)}
          </select>
        </div>
        {rows.length === 0 ? <Empty icon="🧾" title="Aucun document" hint="Importez COM_Document ou créez un document." /> : (
          <div className="space-y-1.5">
            {rows.map((d) => (
              <div key={d.id} className="card flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{d.numero} <span className="ml-1 rounded-lg bg-[#4a7c59]/10 px-2 py-0.5 text-[11px] font-bold text-[#4a7c59]">{TYPE_FR[d.type_doc] ?? d.type_doc}</span></p>
                  <p className="text-xs text-[#7c8091]">{(d as any).erp_tiers?.raison_sociale ?? "—"} · {d.date_doc} · {d.statut}</p>
                </div>
                <p className="text-sm font-black">{Number(d.total_ttc ?? 0).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={() => setOpen(false)}>
          <form onClick={(e) => e.stopPropagation()} action={async (fd) => { await ajouterDocument(fd); setOpen(false); }} className="card w-full max-w-lg space-y-3 p-5">
            <h3 className="text-lg font-extrabold">Nouveau document</h3>
            <div className="grid grid-cols-2 gap-2">
              <input name="numero" placeholder="N° document" className="input" required />
              <select name="type_doc" className="input" defaultValue="facture">{TYPES.map((t) => <option key={t} value={t}>{TYPE_FR[t]}</option>)}</select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select name="tiers_id" className="input" defaultValue="">
                <option value="">Tiers…</option>
                {tiers.map((t) => <option key={t.id} value={t.id}>{t.raison_sociale}</option>)}
              </select>
              <input name="date_doc" type="date" className="input" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input name="total_ht" type="number" step="0.01" placeholder="Total HT" className="input" />
              <input name="total_ttc" type="number" step="0.01" placeholder="Total TTC" className="input" />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost px-4 py-2 text-sm">Annuler</button>
              <button className={cn("btn-fire px-4 py-2 text-sm")}>Enregistrer</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
