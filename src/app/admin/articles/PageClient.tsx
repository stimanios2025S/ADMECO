"use client";
import { useMemo, useState } from "react";
import { Plus, Search, Ban, Boxes } from "lucide-react";
import { GlassCard, SectionTitle, Empty } from "@/components/admin/ui";
import { ajouterArticle } from "@/app/actions-erp";
import { cn } from "@/lib/utils";

export default function PageClient({ articles, familles }: { articles: any[]; familles: any[] }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [fam, setFam] = useState("");
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return articles.filter((a) =>
      (!fam || a.famille_id === fam) &&
      (!needle || `${a.code} ${a.designation}`.toLowerCase().includes(needle)));
  }, [articles, q, fam]);
  const nomFam = (id: string) => familles.find((f) => f.id === id)?.nom ?? (articles.find((a) => a.famille_id === id) as any)?.erp_familles?.nom ?? "—";

  return (
    <div className="stagger space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card flex items-center gap-3 p-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#4a7c59]/10 text-[#4a7c59]"><Boxes size={20} /></span>
          <div><p className="text-2xl font-black">{articles.length}</p><p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Articles</p></div>
        </div>
        <div className="card p-4"><p className="text-2xl font-black">{familles.length}</p><p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Familles</p></div>
        <div className="card p-4"><p className="text-2xl font-black">{articles.filter((a) => a.stock_logique <= a.stock_min).length}</p><p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Sous le seuil</p></div>
        <div className="card p-4"><p className="text-2xl font-black">{articles.filter((a) => a.bloque).length}</p><p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Bloqués</p></div>
      </div>

      <GlassCard>
        <SectionTitle kicker="Référentiel" title="Articles ADMEDCO" hint="Code, désignation, famille, prix, stock logique, réservé, seuils — importés de COM_Item."
          right={<button onClick={() => setOpen(true)} className="btn-fire inline-flex items-center gap-1 px-4 py-2 text-sm"><Plus size={15} /> Ajouter</button>} />
        <div className="mb-3 flex flex-wrap gap-2">
          <label className="flex flex-1 min-w-[220px] items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2">
            <Search size={15} className="text-[#7c8091]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher code ou désignation…" className="w-full bg-transparent text-sm outline-none" />
          </label>
          <select value={fam} onChange={(e) => setFam(e.target.value)} className="input max-w-[240px]">
            <option value="">Toutes familles</option>
            {familles.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
          </select>
        </div>
        {rows.length === 0 ? <Empty icon="📦" title="Aucun article" hint="Exécutez la migration 0009 puis importez COM_Item, ou ajoutez un article." /> : (
          <div className="space-y-1.5">
            {rows.map((a) => (
              <div key={a.id} className={cn("card flex items-center gap-3 p-3", a.bloque && "opacity-60")}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{a.designation} {a.bloque && <span className="ml-1 inline-flex items-center gap-1 text-xs text-red-500"><Ban size={12} /> Bloqué</span>}</p>
                  <p className="text-xs text-[#7c8091]">{a.code || "—"} · {nomFam(a.famille_id)} · {a.unite} · Achat {Number(a.prix_achat ?? 0).toLocaleString()} · Vente {Number(a.prix_vente ?? 0).toLocaleString()}</p>
                </div>
                <div className="text-right text-xs">
                  <p className={cn("font-black", a.stock_logique <= a.stock_min ? "text-red-500" : "text-[#1a1d23]")}>{Number(a.stock_logique ?? 0).toLocaleString()} <span className="font-medium text-[#7c8091]">{a.unite}</span></p>
                  <p className="text-[#7c8091]">Réservé {Number(a.stock_reserve ?? 0).toLocaleString()} · Min {Number(a.stock_min ?? 0).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={() => setOpen(false)}>
          <form onClick={(e) => e.stopPropagation()} action={async (fd) => { await ajouterArticle(fd); setOpen(false); }}
            className="card w-full max-w-lg space-y-3 p-5">
            <h3 className="text-lg font-extrabold">Nouvel article</h3>
            <div className="grid grid-cols-2 gap-2">
              <input name="code" placeholder="Code" className="input" required />
              <input name="code_barres" placeholder="Code-barres" className="input" />
            </div>
            <input name="designation" placeholder="Désignation" className="input" required />
            <div className="grid grid-cols-2 gap-2">
              <select name="famille_id" className="input" defaultValue="">
                <option value="">Famille…</option>
                {familles.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
              </select>
              <input name="unite" placeholder="Unité (pcs, m, kg…)" className="input" defaultValue="pcs" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input name="prix_achat" type="number" step="0.01" placeholder="Prix achat" className="input" />
              <input name="prix_vente" type="number" step="0.01" placeholder="Prix vente" className="input" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input name="stock_logique" type="number" step="0.001" placeholder="Stock initial" className="input" />
              <input name="stock_min" type="number" step="0.001" placeholder="Seuil min" className="input" />
              <input name="stock_max" type="number" step="0.001" placeholder="Seuil max" className="input" />
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
