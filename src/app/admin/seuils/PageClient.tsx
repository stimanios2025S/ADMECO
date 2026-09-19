"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Save, Scale, TrendingDown } from "lucide-react";
import { GlassCard, SectionTitle, Stat, Empty, StatusPill } from "@/components/admin/ui";
import { fixerSeuils } from "@/app/actions-workflow";

type SousSeuil = {
  id: string;
  code: string;
  nom: string;
  depotCode: string;
  usine: string;
  dispo: number;
  reserve: number;
  min: number;
  max: number | null;
  manque: number;
};

type Dette = {
  articleId: string | null;
  usine: string;
  atelierId: number | null;
  depotCode: string | null;
  qtyDue: number;
  nbLignes: number;
  depuis: string | null;
};

type Stock = {
  id: string;
  code: string;
  nom: string;
  depotCode: string;
  usine: string;
  quantite: number;
  min: number | null;
  max: number | null;
};

export default function PageClient({
  sousSeuil,
  dette,
  stocks,
  erreur,
}: {
  sousSeuil: SousSeuil[];
  dette: Dette[];
  stocks: Stock[];
  erreur: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [filtreUsine, setFiltreUsine] = useState<string>("");
  const [recherche, setRecherche] = useState("");
  const [saisie, setSaisie] = useState<Record<string, { min: string; max: string }>>({});

  const detteTotale = useMemo(() => dette.reduce((n, d) => n + (Number(d.qtyDue) || 0), 0), [dette]);
  const avecSeuil = useMemo(() => stocks.filter((s) => s.min !== null).length, [stocks]);

  const stocksFiltres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return stocks.filter((s) => {
      if (filtreUsine && s.usine !== filtreUsine) return false;
      if (!q) return true;
      return `${s.code} ${s.nom} ${s.depotCode}`.toLowerCase().includes(q);
    });
  }, [stocks, filtreUsine, recherche]);

  const valeur = (s: Stock) =>
    saisie[s.id] ?? {
      min: s.min === null ? "" : String(s.min),
      max: s.max === null ? "" : String(s.max),
    };

  const enregistrer = (s: Stock, min: string, max: string) => {
    setMessage(null);
    start(async () => {
      const r = await fixerSeuils({
        stockItemId: s.id,
        minQty: min.trim() === "" ? null : Number(min),
        maxQty: max.trim() === "" ? null : Number(max),
      });
      setMessage({ ok: r.ok, texte: r.message });
      if (r.ok) router.refresh();
    });
  };

  return (
    <div className="stagger space-y-5">
      {erreur && (
        <div className="card border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">{erreur}</div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Sous le plancher" value={String(sousSeuil.length)} accent={sousSeuil.length > 0 ? "red" : undefined} sub="À regarnir" />
        <Stat label="Dette ouverte" value={String(detteTotale)} accent="ice" sub={`${dette.length} article(s)`} />
        <Stat label="Articles sous seuil" value={String(avecSeuil)} sub={`sur ${stocks.length} suivis`} />
        <Stat label="Manque cumulé" value={String(Math.round(sousSeuil.reduce((n, s) => n + s.manque, 0)))} accent="fire" sub="Unités à produire" />
      </div>

      {message && (
        <div className={`card p-4 text-sm ${message.ok ? "border-[#4a7c59]/30 bg-[#4a7c59]/5 text-[#2f5a3c]" : "border-red-200 bg-red-50 text-red-600"}`}>
          {message.texte}
        </div>
      )}

      {/* ═══════════ SOUS LE PLANCHER ═══════════ */}
      <GlassCard>
        <SectionTitle
          kicker="Le déclencheur"
          title="Stocks sous leur plancher"
          hint="Ce sont ces lignes qui créent une dette. Le manque n'est pas produit sur-le-champ : il est absorbé par la commande suivante."
        />
        {sousSeuil.length === 0 ? (
          <Empty icon="✅" title="Aucun stock sous son plancher" hint="Tous les sous-stocks suivis sont au-dessus de leur minimum." />
        ) : (
          <div className="space-y-1.5">
            {sousSeuil.map((s) => (
              <div key={s.id} className="card flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
                    <AlertTriangle size={14} className="text-[#c24a08]" />
                    {s.code} — {s.nom}
                  </p>
                  <p className="text-xs text-[#7c8091]">
                    {s.usine} · {s.depotCode} · disponible {Math.round(s.dispo)} (dont {Math.round(s.reserve)} réservé)
                  </p>
                </div>
                <div className="flex items-end gap-2">
                  <Champ label="Plancher" value={valeur(stockDepuis(s, stocks)).min} onChange={(v) => setSaisie((x) => ({ ...x, [s.id]: { ...valeur(stockDepuis(s, stocks)), min: v } }))} />
                  <Champ label="Plafond" value={valeur(stockDepuis(s, stocks)).max} onChange={(v) => setSaisie((x) => ({ ...x, [s.id]: { ...valeur(stockDepuis(s, stocks)), max: v } }))} />
                  <span className="pb-2 text-right text-xs">
                    <strong className="block text-base tabular-nums text-red-500">−{Math.round(s.manque)}</strong>
                    <span className="text-[#7c8091]">manque</span>
                  </span>
                  <button
                    onClick={() => {
                      const v = valeur(stockDepuis(s, stocks));
                      enregistrer(stockDepuis(s, stocks), v.min, v.max);
                    }}
                    disabled={pending}
                    className="btn-fire mb-0.5 inline-flex items-center gap-1 px-3 py-2 text-xs disabled:opacity-50"
                  >
                    <Save size={13} /> Seuil
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* ═══════════ DETTE ═══════════ */}
      <GlassCard>
        <SectionTitle
          kicker="La récupération"
          title="Dette de production ouverte"
          hint="Ce que la prochaine commande produira en plus. Exemple : sous-stock 500 − commande 350 = 150, plancher 200 → 50 en dette ; la commande suivante de 400 en produira 450."
        />
        {dette.length === 0 ? (
          <Empty icon="⚖️" title="Aucune dette ouverte" hint="Chaque commande a été couverte sans descendre sous le plancher." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-widest text-[#7c8091]">
                  <th className="py-2">Usine</th>
                  <th className="py-2">Dépôt</th>
                  <th className="py-2">Atelier</th>
                  <th className="py-2 text-right">Qté due</th>
                  <th className="py-2 text-right">Lignes</th>
                  <th className="py-2">Depuis</th>
                </tr>
              </thead>
              <tbody>
                {dette.map((d, i) => (
                  <tr key={`${d.depotCode}-${i}`} className="border-t border-black/5">
                    <td className="py-2">
                      <span className="inline-flex items-center gap-1 font-bold">
                        <Scale size={12} /> {d.usine}
                      </span>
                    </td>
                    <td className="py-2 text-xs text-[#7c8091]">{d.depotCode ?? "—"}</td>
                    <td className="py-2 text-xs text-[#7c8091]">{d.atelierId ?? "—"}</td>
                    <td className="py-2 text-right font-black tabular-nums text-[#c24a08]">{Math.round(d.qtyDue)}</td>
                    <td className="py-2 text-right tabular-nums text-xs">{d.nbLignes}</td>
                    <td className="py-2 text-xs text-[#7c8091]">
                      {d.depuis ? new Date(d.depuis).toLocaleDateString("fr-FR") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* ═══════════ TOUS LES SEUILS ═══════════ */}
      <GlassCard>
        <SectionTitle
          kicker="Le référentiel"
          title="Tous les seuils"
          hint="Videz le plancher pour retirer un article du suivi : il ne déclenchera plus de dette."
          right={
            <div className="flex gap-2">
              <select className="input w-36" value={filtreUsine} onChange={(e) => setFiltreUsine(e.target.value)}>
                <option value="">Toutes usines</option>
                <option value="ADMEDCO">ADMEDCO</option>
                <option value="MOBILIX">MOBILIX</option>
              </select>
              <input
                className="input w-52"
                placeholder="Code, nom, dépôt…"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
              />
            </div>
          }
        />
        {stocksFiltres.length === 0 ? (
          <Empty icon="📦" title="Aucun stock à afficher" hint="Le stock est alimenté par l'import Silwane et la réception matière." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-widest text-[#7c8091]">
                  <th className="py-2">Article</th>
                  <th className="py-2">Dépôt</th>
                  <th className="py-2 text-right">En stock</th>
                  <th className="py-2 text-right">Plancher</th>
                  <th className="py-2 text-right">Plafond</th>
                  <th className="py-2 text-right">État</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {stocksFiltres.slice(0, 200).map((s) => {
                  const v = valeur(s);
                  const bas = s.min !== null && s.quantite <= s.min;
                  return (
                    <tr key={s.id} className="border-t border-black/5">
                      <td className="py-2">
                        <span className="block font-bold">{s.code}</span>
                        <span className="block text-[11px] text-[#7c8091]">{s.nom}</span>
                      </td>
                      <td className="py-2 text-xs text-[#7c8091]">
                        {s.depotCode}
                        <span className="block">{s.usine}</span>
                      </td>
                      <td className="py-2 text-right tabular-nums">{Math.round(s.quantite)}</td>
                      <td className="py-2 text-right">
                        <input
                          className="input w-20 text-right"
                          type="number"
                          min={0}
                          placeholder="—"
                          value={v.min}
                          onChange={(e) => setSaisie((x) => ({ ...x, [s.id]: { ...v, min: e.target.value } }))}
                        />
                      </td>
                      <td className="py-2 text-right">
                        <input
                          className="input w-20 text-right"
                          type="number"
                          min={0}
                          placeholder="—"
                          value={v.max}
                          onChange={(e) => setSaisie((x) => ({ ...x, [s.id]: { ...v, max: e.target.value } }))}
                        />
                      </td>
                      <td className="py-2 text-right">
                        {s.min === null ? (
                          <span className="text-[11px] text-[#9aa0ab]">non suivi</span>
                        ) : bas ? (
                          <StatusPill status="SOUS_SEUIL" />
                        ) : (
                          <StatusPill status="OK" />
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => enregistrer(s, v.min, v.max)}
                          disabled={pending}
                          className="btn-ghost inline-flex items-center gap-1 px-3 py-1.5 text-xs disabled:opacity-50"
                        >
                          <Save size={12} /> Enregistrer
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {stocksFiltres.length > 200 && (
              <p className="pt-2 text-center text-[11px] text-[#9aa0ab]">
                <TrendingDown size={11} className="mr-1 inline" />
                200 lignes affichées sur {stocksFiltres.length}. Affinez la recherche pour voir les autres.
              </p>
            )}
          </div>
        )}
      </GlassCard>
    </div>
  );
}

function Champ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-widest text-[#7c8091]">{label}</span>
      <input
        className="input mt-0.5 w-20 text-right"
        type="number"
        min={0}
        placeholder="—"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

/**
 * La vue `v_stocks_sous_seuil` ne renvoie pas le plafond quand il est
 * NULL, et l'id est nécessaire pour écrire. On retrouve la ligne
 * complète dans la liste des stocks ; si elle n'y est pas (filtre,
 * limite), on retombe sur les valeurs de la vue.
 */
function stockDepuis(s: SousSeuil, stocks: Stock[]): Stock {
  return (
    stocks.find((x) => x.id === s.id) ?? {
      id: s.id,
      code: s.code,
      nom: s.nom,
      depotCode: s.depotCode,
      usine: s.usine,
      quantite: s.dispo,
      min: s.min,
      max: s.max,
    }
  );
}
