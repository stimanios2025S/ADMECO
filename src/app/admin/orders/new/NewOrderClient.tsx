"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus, Trash2, Package, Search, ClipboardList, Layers, CheckCircle2, AlertTriangle, Wrench,
} from "lucide-react";
import { GlassCard, SectionTitle } from "@/components/admin/ui";
import { creerCommandeClient, trierEtLancerCommande } from "@/app/actions-workflow";
import { ATELIERS } from "@/lib/ateliers";
import {
  PARCOURS_LABEL, PARCOURS_USINE, MODELE_DETAIL, modeleProbable, parcoursProbable,
  routeAvecModele, type ModeleMobilix, type ParcoursProduit,
} from "@/lib/route-production";

// ═══════════════════════════════════════════════════════════
// NOUVELLE COMMANDE — on choisit un ARTICLE, pas un nom libre
//
// ── Ce qui change, et pourquoi ──
// Avant, l'admin tapait « Nom du produit » à la main et choisissait
// une catégorie de démonstration : la nomenclature Silwane et la
// gamme réelle n'étaient JAMAIS lues. Maintenant chaque ligne pointe
// un `erp_articles.id`, et deux panneaux se remplissent tout seuls :
//
//   · GAMME      — les étapes réelles, numérotées par `sequence`
//                  global, avec l'atelier qui les exécute
//   · MATIÈRE    — la formule réelle (composant + quantité), la main
//                  d'œuvre mise à part : elle ne sort pas du stock
//
// ── Le chemin de la validation ──
//   1. creerCommandeClient()      la commande et ses lignes
//   2. trierEtLancerCommande()    le TRIAGE : une chaise, c'est du
//                                 dur (ADMEDCO) + du mou (MOBILIX).
//                                 Deux sous-commandes, jamais
//                                 mélangées, chacune avec sa route
//                                 et sa matière réservée.
//
// On ne crée donc pas « une commande » : on crée une commande
// CLIENT que l'agent de triage éclate en productions réelles.
// ═══════════════════════════════════════════════════════════

export type ArticleFabrique = {
  id: string;
  code: string;
  designation: string;
  famille: string | null;
  unite: string;
  prixVente: number;
  stockLogique: number;
  parcours: ParcoursProduit;
  composants: Array<{
    id: string;
    code: string;
    designation: string;
    quantite: number;
    unite: string;
    mainOeuvre: boolean;
  }>;
};

type Ligne = {
  articleId: string;
  quantite: number;
  /** Parcours proposé par le catalogue, que l'admin peut corriger. */
  parcours: ParcoursProduit | "";
  modele: ModeleMobilix;
  note: string;
};

const atelierCode = (id: number) => ATELIERS.find((a) => a.id === id)?.code ?? String(id);
const atelierNomCourt = (id: number) => {
  const a = ATELIERS.find((x) => x.id === id);
  return a ? a.nom.replace(/^Atelier\s*/i, "").replace(/\s*—.*$/, "") : `Atelier ${id}`;
};

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 });

// ── Comparaison à plat ──
// Les codes Silwane ne sont pas propres : la MÊME nomenclature écrit
// `CHG020` (sans espace) et `CHG 021` (avec), `FIL 7` avec son espace.
// Une recherche littérale sur « CHG021 » ne trouverait donc RIEN — ce
// qui se lit « le produit n'a pas été importé » alors qu'il est bien
// là. On compare donc sur une forme aplatie, où les espaces, les
// accents et la ponctuation ne comptent plus.
const aplatir = (s: string) =>
  s.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z0-9]/g, "");

export default function NewOrderClient({ articles }: { articles: ArticleFabrique[] }) {
  const [clientNom, setClientNom] = useState("");
  const [clientTelephone, setClientTelephone] = useState("");
  const [note, setNote] = useState("");
  const [lignes, setLignes] = useState<Ligne[]>([
    { articleId: "", quantite: 1, parcours: "", modele: "G21", note: "" },
  ]);
  const [recherches, setRecherches] = useState<string[]>([""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resultat, setResultat] = useState<any>(null);

  const parId = useMemo(() => new Map(articles.map((a) => [a.id, a])), [articles]);

  const majLigne = (i: number, patch: Partial<Ligne>) =>
    setLignes((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const majRecherche = (i: number, v: string) =>
    setRecherches((prev) => prev.map((r, idx) => (idx === i ? v : r)));

  const ajouterLigne = () => {
    setLignes((prev) => [...prev, { articleId: "", quantite: 1, parcours: "", modele: "G21", note: "" }]);
    setRecherches((prev) => [...prev, ""]);
  };
  const retirerLigne = (i: number) => {
    setLignes((prev) => prev.filter((_, idx) => idx !== i));
    setRecherches((prev) => prev.filter((_, idx) => idx !== i));
  };

  /** Les articles qui correspondent à la recherche, plafonnés à 60. */
  const suggestions = (i: number): ArticleFabrique[] => {
    const q = aplatir(recherches[i] ?? "");
    const base = q
      ? articles.filter(
          (a) =>
            aplatir(a.code).includes(q) ||
            aplatir(a.designation).includes(q) ||
            aplatir(a.famille ?? "").includes(q),
        )
      : articles;
    return base.slice(0, 60);
  };

  const choisirArticle = (i: number, id: string) => {
    const a = parId.get(id);
    majLigne(i, {
      articleId: id,
      parcours: a ? a.parcours : "",
      modele: a ? modeleProbable(a) : "G21",
    });
  };

  /** Le besoin matière cumulé de la commande — main d'œuvre exclue. */
  const besoinMatiere = useMemo(() => {
    const map = new Map<string, { code: string; designation: string; unite: string; qte: number }>();
    for (const l of lignes) {
      const a = parId.get(l.articleId);
      if (!a || !(l.quantite > 0)) continue;
      for (const c of a.composants) {
        if (c.mainOeuvre) continue;
        const cur = map.get(c.id);
        const qte = c.quantite * l.quantite;
        if (cur) cur.qte += qte;
        else map.set(c.id, { code: c.code, designation: c.designation, unite: c.unite, qte });
      }
    }
    return [...map.values()].sort((x, y) => x.code.localeCompare(y.code));
  }, [lignes, parId]);

  const lignesValides = lignes.filter((l) => l.articleId && l.quantite > 0);
  const pretes = lignesValides.length > 0;

  const valider = async () => {
    setBusy(true);
    setError("");
    setResultat(null);
    try {
      const r1 = await creerCommandeClient({
        clientNom: clientNom.trim() || "Commande interne",
        clientTelephone: clientTelephone.trim(),
        note: note.trim(),
        origine: "SAISIE_ADMIN",
        lignes: lignesValides.map((l) => {
          const a = parId.get(l.articleId)!;
          const modele = l.parcours === "MOBILIX" ? ` · ${l.modele}` : "";
          return {
            articleId: a.id,
            designation: `${a.code} — ${a.designation}${modele}`,
            quantite: l.quantite,
            prixUnitaire: a.prixVente,
            note: l.note.trim(),
          };
        }),
      });
      if (!r1.ok || !r1.commandeId) throw new Error(r1.message);

      const r2 = await trierEtLancerCommande({ commandeId: r1.commandeId, preparerLaMatiere: true });
      if (!r2.ok) throw new Error(`${r1.message} — puis : ${r2.message}`);

      setResultat({ numero: r1.numero, ...r2 });
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
    setBusy(false);
  };

  // ── Écran de résultat : les sous-commandes réellement créées ──
  if (resultat) {
    return (
      <div className="stagger space-y-5">
        <GlassCard className="border-emerald-300 bg-emerald-50/60">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={22} />
            <div className="space-y-1">
              <p className="font-black text-[#1a1d23]">Commande {resultat.numero} enregistrée et lancée</p>
              <p className="text-sm text-[#5b6070]">{resultat.message}</p>
            </div>
          </div>
        </GlassCard>

        {(resultat.sousCommandes ?? []).length > 0 && (
          <GlassCard>
            <SectionTitle
              kicker="Production"
              title="Sous-commandes créées"
              hint="Chaque usine est un ordre de fabrication distinct — jamais mélangées."
            />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(resultat.sousCommandes as any[]).map((s, i) => (
                <div key={i} className="card space-y-1 p-3">
                  <p className="font-mono text-[11px] text-[#c24a08]">{s.usine}</p>
                  <p className="text-sm font-bold">{s.etapes} étapes instanciées</p>
                  <p className="font-mono text-[10px] text-[#9aa0ae]">{s.itemId?.slice(0, 8)}…</p>
                </div>
              ))}
            </div>
          </GlassCard>
        )}

        {(resultat.nonClassee ?? []).length > 0 && (
          <GlassCard className="border-amber-300 bg-amber-50/60">
            <SectionTitle
              kicker="À confirmer"
              title={`${resultat.nonClassee.length} composant(s) non classés`}
              hint="Le triage par mots-clés n'a pas su leur attribuer une usine. La commande n'est pas bloquée."
            />
            <div className="flex flex-wrap gap-1.5">
              {(resultat.nonClassee as any[]).map((n, i) => (
                <span key={i} className="rounded-lg border border-amber-300 bg-white px-2 py-1 font-mono text-[11px]">
                  {n.code} — {n.designation}
                </span>
              ))}
            </div>
          </GlassCard>
        )}

        <div className="flex flex-wrap gap-2">
          <Link href="/admin/commandes" className="btn-fire px-5 py-3 text-sm font-black">
            Voir les commandes client
          </Link>
          <Link href="/admin/orders" className="card px-5 py-3 text-sm font-bold">
            Voir les ordres de fabrication
          </Link>
          <button
            onClick={() => {
              setResultat(null);
              setLignes([{ articleId: "", quantite: 1, parcours: "", modele: "G21", note: "" }]);
              setRecherches([""]);
              setClientNom("");
              setNote("");
            }}
            className="card px-5 py-3 text-sm font-bold"
          >
            Créer une autre commande
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="stagger space-y-5">
      {articles.length === 0 && (
        <GlassCard className="border-amber-300 bg-amber-50/60">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={20} />
            <p className="text-sm text-[#5b6070]">
              Aucun article fabricable dans le catalogue. Lancez l'import Silwane pour que vos vrais
              produits (CHAISE VISITEUR G 020/021…) apparaissent ici.
            </p>
          </div>
        </GlassCard>
      )}

      <GlassCard>
        <SectionTitle kicker="Commande" title="Client et en-tête" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            placeholder="Nom du client — ex. SARL Bureau Plus"
            value={clientNom}
            onChange={(e) => setClientNom(e.target.value)}
            className="input px-4 py-2.5 text-sm"
          />
          <input
            placeholder="Téléphone (optionnel)"
            value={clientTelephone}
            onChange={(e) => setClientTelephone(e.target.value)}
            className="input px-4 py-2.5 text-sm"
          />
          <input
            placeholder="Note interne (optionnel)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="input px-4 py-2.5 text-sm"
          />
        </div>
      </GlassCard>

      <GlassCard>
        <SectionTitle
          kicker="Produits"
          title="Articles de la commande"
          hint="Cherchez par code ou désignation, puis cliquez l'article. Sa gamme et sa nomenclature réelles s'affichent."
          right={
            <button onClick={ajouterLigne} className="btn-fire inline-flex items-center gap-1 px-3 py-2 text-sm">
              <Plus size={15} /> Ajouter un article
            </button>
          }
        />

        <div className="space-y-5">
          {lignes.map((ligne, i) => {
            const a = parId.get(ligne.articleId);
            const parcours = (ligne.parcours || a?.parcours || "") as ParcoursProduit | "";
            const route = parcours ? routeAvecModele(parcours, ligne.modele) : [];
            const matieres = a?.composants.filter((c) => !c.mainOeuvre) ?? [];
            const mo = a?.composants.filter((c) => c.mainOeuvre) ?? [];
            const parAtelier = route.reduce<Record<number, typeof route>>((acc, e) => {
              (acc[e.atelier] ??= []).push(e);
              return acc;
            }, {});

            return (
              <div key={i} className="card space-y-4 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-[#c24a08]">LIGNE #{i + 1}</span>
                  {lignes.length > 1 && (
                    <button
                      onClick={() => retirerLigne(i)}
                      className="grid h-7 w-7 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-500"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                <div className="grid gap-3 lg:grid-cols-[1.4fr_auto]">
                  <div className="space-y-2">
                    <label className="relative block">
                      <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa0ae]" />
                      <input
                        placeholder="Rechercher — CHG020, chaise, tapissage…"
                        value={recherches[i] ?? ""}
                        onChange={(e) => majRecherche(i, e.target.value)}
                        className="input w-full py-2.5 pl-9 pr-3 text-sm"
                      />
                    </label>
                    <select
                      size={6}
                      value={ligne.articleId}
                      onChange={(e) => choisirArticle(i, e.target.value)}
                      className="input w-full px-3 py-2 font-mono text-xs leading-relaxed"
                    >
                      {suggestions(i).length === 0 && <option value="">Aucun article ne correspond</option>}
                      {suggestions(i).map((x) => (
                        <option key={x.id} value={x.id} className="bg-white py-1">
                          {x.code} — {x.designation}
                          {x.famille ? `  ·  ${x.famille}` : ""}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-[#9aa0ae]">
                      {articles.length} articles fabricables au catalogue
                      {recherches[i]?.trim() ? ` · ${suggestions(i).length} affiché(s)` : " · affinez la recherche"}
                      {" · "}
                      <span title="CHG020 s'écrit sans espace, CHG 021 avec : la comparaison ignore les espaces">
                        les espaces ne comptent pas
                      </span>
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold uppercase tracking-wide text-[#7c8091]">
                      Quantité
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={ligne.quantite}
                      onChange={(e) => majLigne(i, { quantite: Math.max(1, Number(e.target.value)) })}
                      className="input w-full px-3 py-2.5 text-sm lg:w-28"
                    />
                    <label className="block text-[11px] font-bold uppercase tracking-wide text-[#7c8091]">
                      Parcours
                    </label>
                    <select
                      value={parcours}
                      onChange={(e) => majLigne(i, { parcours: e.target.value as ParcoursProduit })}
                      className="input w-full px-2 py-2 text-xs lg:w-64"
                    >
                      {(Object.keys(PARCOURS_LABEL) as ParcoursProduit[]).map((p) => (
                        <option key={p} value={p} className="bg-white">
                          {PARCOURS_LABEL[p]}
                        </option>
                      ))}
                    </select>
                    {parcours === "MOBILIX" && (
                      <select
                        value={ligne.modele}
                        onChange={(e) => majLigne(i, { modele: e.target.value as ModeleMobilix })}
                        className="input w-full px-2 py-2 text-xs lg:w-64"
                      >
                        <option value="G21" className="bg-white">Modèle G21 — {MODELE_DETAIL.G21.inserts}</option>
                        <option value="CANADA" className="bg-white">Modèle CANADA — {MODELE_DETAIL.CANADA.inserts}</option>
                      </select>
                    )}
                    <input
                      placeholder="Note de ligne (optionnel)"
                      value={ligne.note}
                      onChange={(e) => majLigne(i, { note: e.target.value })}
                      className="input w-full px-3 py-2 text-xs lg:w-64"
                    />
                  </div>
                </div>

                {a && parcours && (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {/* ── La gamme réelle ── */}
                    <div className="rounded-xl border border-[#e6e4df] bg-[#fbfaf8] p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <Wrench size={14} className="text-[#c24a08]" />
                        <p className="text-xs font-black uppercase tracking-wide text-[#5b6070]">
                          Gamme proposée — {route.length} étapes
                        </p>
                        <span className="ml-auto rounded-md bg-white px-2 py-0.5 font-mono text-[10px] text-[#7c8091]">
                          {PARCOURS_USINE[parcours]}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {Object.entries(parAtelier)
                          .sort((x, y) => Number(x[0]) - Number(y[0]))
                          .map(([atelierId, etapes]) => (
                            <div key={atelierId}>
                              <p className="mb-1 font-mono text-[10px] font-bold text-[#4a7c59]">
                                {atelierCode(Number(atelierId))} · {atelierNomCourt(Number(atelierId))}
                              </p>
                              <ol className="space-y-0.5">
                                {etapes.map((e) => (
                                  <li key={e.code} className="flex items-baseline gap-2 text-[12px]">
                                    <span className="w-10 shrink-0 text-right font-mono text-[10px] text-[#9aa0ae]">
                                      {e.sequence}
                                    </span>
                                    <span className="shrink-0">
                                      {e.icone}
                                    </span>
                                    <span className="text-[#1a1d23]">{e.nom}</span>
                                  </li>
                                ))}
                              </ol>
                            </div>
                          ))}
                      </div>
                      <p className="mt-2 text-[10px] leading-relaxed text-[#9aa0ae]">
                        Le nombre de gauche est la <b>séquence globale</b> : c'est elle qui dit ce qui
                        vient avant quoi, tous ateliers confondus. Cette gamme est une{" "}
                        <b>proposition</b> : à la validation, l'agent de triage la recalcule à partir
                        des composants réels de la formule.
                      </p>
                    </div>

                    {/* ── La nomenclature réelle ── */}
                    <div className="rounded-xl border border-[#e6e4df] bg-[#fbfaf8] p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <Layers size={14} className="text-[#c24a08]" />
                        <p className="text-xs font-black uppercase tracking-wide text-[#5b6070]">
                          Nomenclature — {a.composants.length} lignes
                        </p>
                        <span className="ml-auto rounded-md bg-white px-2 py-0.5 font-mono text-[10px] text-[#7c8091]">
                          {a.code}
                        </span>
                      </div>

                      {a.composants.length === 0 ? (
                        <p className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-2 text-[11px] text-amber-700">
                          Aucune formule Silwane pour cet article : la matière ne sera pas réservée
                          automatiquement.
                        </p>
                      ) : (
                        <>
                          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[#9aa0ae]">
                            Matière à sortir du stock — {matieres.length}
                          </p>
                          <div className="max-h-56 space-y-0.5 overflow-y-auto pr-1">
                            {matieres.map((c) => (
                              <div key={c.id} className="flex items-baseline gap-2 text-[12px]">
                                <span className="w-24 shrink-0 font-mono text-[10px] text-[#c24a08]">{c.code}</span>
                                <span className="flex-1 truncate text-[#1a1d23]">{c.designation}</span>
                                <span className="shrink-0 font-mono text-[11px] text-[#5b6070]">
                                  {nf.format(c.quantite * ligne.quantite)} {c.unite}
                                </span>
                              </div>
                            ))}
                          </div>
                          {mo.length > 0 && (
                            <>
                              <p className="mb-1 mt-2 text-[10px] font-bold uppercase tracking-wide text-[#9aa0ae]">
                                Main d'œuvre — {mo.length} (jamais prélevée du stock)
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {mo.map((c) => (
                                  <span
                                    key={c.id}
                                    className="rounded-md border border-[#e6e4df] bg-white px-1.5 py-0.5 font-mono text-[10px] text-[#7c8091]"
                                  >
                                    {c.code}
                                  </span>
                                ))}
                              </div>
                            </>
                          )}
                          <p className="mt-2 text-[10px] text-[#9aa0ae]">
                            Quantités <b>× {ligne.quantite}</b> — la réservation réelle appliquera le
                            rendement matière enregistré.
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </GlassCard>

      {besoinMatiere.length > 0 && (
        <GlassCard className="border-[#c24a08]/25 bg-[#c24a08]/5">
          <SectionTitle
            kicker="Besoin matière"
            title={`${besoinMatiere.length} référence(s) à réserver`}
            hint="Cumul de toutes les lignes, main d'œuvre exclue. La réservation est faite par l'agent matière, avec le rendement réel de chaque article."
          />
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {besoinMatiere.map((m) => (
              <div key={m.code} className="card px-3 py-2 text-sm">
                <p className="font-mono text-[10px] text-[#c24a08]">{m.code}</p>
                <p className="truncate text-xs" title={m.designation}>{m.designation}</p>
                <p className="font-mono text-[#1a1d23]">
                  {nf.format(m.qte)} <span className="text-[10px] text-[#9aa0ae]">{m.unite}</span>
                </p>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-500">{error}</p>
      )}

      <button
        disabled={busy || !pretes}
        onClick={valider}
        className="btn-fire inline-flex w-full items-center justify-center gap-2 px-6 py-3.5 text-sm font-black disabled:opacity-50 sm:w-auto"
      >
        {resultat ? <ClipboardList size={18} /> : <Package size={18} />}
        {busy ? "Création et triage…" : "Créer la commande et lancer la production"}
      </button>
      <p className="text-[11px] text-[#9aa0ae]">
        La commande est enregistrée, puis l'agent de <b>triage</b> l'éclate par usine : une chaise
        devient un ordre ADMEDCO (le dur) <i>et</i> un ordre MOBILIX (le mou), chacun avec sa gamme
        réelle et sa matière réservée.
      </p>
    </div>
  );
}
