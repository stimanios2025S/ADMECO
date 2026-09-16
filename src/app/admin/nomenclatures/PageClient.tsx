"use client";
import { useMemo, useState } from "react";
import { Search, Factory, ListTree } from "lucide-react";
import { GlassCard, SectionTitle, Empty } from "@/components/admin/ui";

type Groupe = { key: string; pf_id: string; pf_code: string; pf_designation: string; code_formule: string; lignes: any[] };

export default function PageClient({ lignes, couts }: { lignes: any[]; couts: any[] }) {
  const [q, setq] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const groupes: Groupe[] = useMemo(() => {
    const m = new Map<string, Groupe>();
    for (const l of lignes) {
      const k = String(l.pf_id ?? l.pf_code);
      if (!m.has(k)) m.set(k, { key: k, pf_id: String(l.pf_id ?? ""), pf_code: l.pf_code, pf_designation: l.pf_designation, code_formule: l.code_formule, lignes: [] });
      m.get(k)!.lignes.push(l);
    }
    const needle = q.trim().toLowerCase();
    return [...m.values()].filter((g) =>
      !needle || `${g.pf_code} ${g.pf_designation} ${g.code_formule}`.toLowerCase().includes(needle));
  }, [lignes, q]);

  const coutParPf = useMemo(() => new Map(couts.map((c) => [String(c.pf_id), c])), [couts]);

  return (
    <div className="stagger space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card flex items-center gap-3 p-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#4a7c59]/10 text-[#4a7c59]"><Factory size={20} /></span>
          <div><p className="text-2xl font-black">{groupes.length}</p><p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Produits fabriqués</p></div>
        </div>
        <div className="card p-4"><p className="text-2xl font-black">{lignes.length}</p><p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Lignes composants</p></div>
        <div className="card p-4"><p className="text-2xl font-black">{couts.length}</p><p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Coûts calculés</p></div>
        <div className="card p-4"><p className="text-2xl font-black">{Math.round(couts.reduce((s, c) => s + Number(c.cout_matiere_estime ?? 0), 0)).toLocaleString()}</p><p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Coût matière total</p></div>
      </div>

      <GlassCard>
        <SectionTitle kicker="Recettes" title="Nomenclatures importées de Silwane" hint="Cliquez sur un produit pour voir ses composants et quantités." />
        <div className="mb-3">
          <label className="flex flex-1 min-w-[220px] items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2">
            <Search size={15} className="text-[#7c8091]" />
            <input value={q} onChange={(e) => setq(e.target.value)} placeholder="Rechercher produit ou formule…" className="w-full bg-transparent text-sm outline-none" />
          </label>
        </div>
        {groupes.length === 0 ? <Empty icon="🧾" title="Aucune nomenclature" hint="Exécutez la migration 0011 puis le script scripts/import-silwane.mjs." /> : (
          <div className="space-y-1.5">
            {groupes.map((g) => {
              const c = coutParPf.get(g.pf_id);
              const opened = open === g.key;
              return (
                <div key={g.key} className="card overflow-hidden">
                  <button onClick={() => setOpen(opened ? null : g.key)} className="flex w-full items-center gap-3 p-3 text-left">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#4a7c59]/10 text-[#4a7c59]"><ListTree size={17} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{g.pf_designation}</p>
                      <p className="text-xs text-[#7c8091]">{g.pf_code} · Formule {g.code_formule} · {g.lignes.length} composant{g.lignes.length > 1 ? "s" : ""}</p>
                    </div>
                    <div className="text-right text-xs">
                      <p className="font-black">{c ? `${Math.round(Number(c.cout_matiere_estime ?? 0)).toLocaleString()} DA` : "—"}</p>
                      <p className="text-[#7c8091]">{opened ? "Fermer ▲" : "Détail ▼"}</p>
                    </div>
                  </button>
                  {opened && (
                    <div className="border-t border-black/[0.06] bg-[#f5f6f2] px-3 py-2">
                      {g.lignes.map((l: any) => (
                        <div key={l.id} className="flex items-center gap-2 border-b border-black/[0.04] py-2 text-sm last:border-0">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-bold">{l.comp_designation}</p>
                            <p className="text-xs text-[#7c8091]">{l.comp_code} · {l.comp_unite} · {Number(l.comp_prix_achat ?? 0).toLocaleString()} DA</p>
                          </div>
                          <p className="shrink-0 text-sm font-black">× {Number(l.quantite ?? 0).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
