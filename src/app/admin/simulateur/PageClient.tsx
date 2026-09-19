"use client";

import { useMemo, useState, useTransition } from "react";
import { Play, Search, Factory, PackageOpen, AlertTriangle, Route, FlaskConical } from "lucide-react";
import { GlassCard, SectionTitle, Stat, Empty } from "@/components/admin/ui";
import { simulerCommande } from "@/app/actions-workflow";

type Article = { id: string; code: string; designation: string; unite: string; nbComposants: number };
type Rapport = Awaited<ReturnType<typeof simulerCommande>>;

// Ce que chaque parcours veut dire, en clair. Un parcours est un
// chemin d'ateliers, pas un nom de code : l'exploitant doit lire
// où la pièce passe, pas « ADMEDCO_ASSEMBLE ».
const PARCOURS_FR: Record<string, string> = {
  ADMEDCO_ASSEMBLE: "ADMEDCO — A1 tôle → A3 poudrage → A2 montage → A3 emballage",
  ADMEDCO_TOLE: "ADMEDCO — A1 tôle → A3 poudrage (s'arrête au semi-fini)",
  MOBILIX: "MOBILIX — M2 coupe → M1 bois → M2 couture & tapissage",
};

const DESTINATION_FR: Record<string, string> = {
  MOBILIX: "Part ADMEDCO envoyée à MOBILIX pour l'assemblage final",
  CLIENT_DIRECT: "Livraison directe au client",
  STOCK_PF: "Entrée en stock produit fini",
};

const d3 = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(n);

export default function PageClient({ catalogue, erreur }: { catalogue: Article[]; erreur: string | null }) {
  const [pending, start] = useTransition();
  const [recherche, setRecherche] = useState("");
  const [articleId, setArticleId] = useState("");
  const [quantite, setQuantite] = useState("10");
  const [rapport, setRapport] = useState<Rapport | null>(null);

  const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

  const filtres = useMemo(() => {
    const q = norm(recherche);
    const liste = q
      ? catalogue.filter((a) => norm(a.code).includes(q) || norm(a.designation).includes(q))
      : catalogue;
    return liste.slice(0, 80);
  }, [catalogue, recherche]);

  const choisi = catalogue.find((a) => a.id === articleId) ?? null;

  const simuler = () => {
    if (!articleId) return;
    setRapport(null);
    start(async () => {
      const r = await simulerCommande({ articleId, quantite: Number(quantite) || 0 });
      setRapport(r);
    });
  };

  const totalEtapes = rapport?.parts.reduce((n, p) => n + p.nbEtapes, 0) ?? 0;

  return (
    <div className="stagger space-y-5">
      {erreur && (
        <div className="card border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          Référentiel partiellement lisible : {erreur}
        </div>
      )}

      <GlassCard>
        <SectionTitle
          kicker="Lecture seule"
          title="Choisir le produit à simuler"
          hint="Le simulateur n'écrit rien : il montre les ordres de fabrication, les étapes par atelier et la matière qu'un lancement réel créerait."
        />

        <div className="grid gap-3 md:grid-cols-[1fr_20rem]">
          <div className="space-y-3">
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Rechercher</span>
              <div className="relative mt-1">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
                <input
                  className="input pl-9"
                  placeholder="Ex. CHAISE VISITEUR, CHG020, G 021…"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                />
              </div>
            </label>

            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">
                Produit — {filtres.length} sur {catalogue.length}
              </span>
              <select className="input mt-1" value={articleId} onChange={(e) => setArticleId(e.target.value)}>
                <option value="">— Choisir un produit fabriqué —</option>
                {filtres.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.designation} ({a.nbComposants} composants)
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Quantité</span>
              <input
                className="input mt-1"
                type="number"
                min={1}
                value={quantite}
                onChange={(e) => setQuantite(e.target.value)}
              />
            </label>
            <button
              onClick={simuler}
              disabled={pending || !articleId}
              className="btn-fire inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm disabled:opacity-50"
            >
              <Play size={14} /> {pending ? "Simulation…" : "Simuler la chaîne"}
            </button>
            {choisi && (
              <p className="text-[12px] leading-relaxed text-[#7c8091]">
                {choisi.nbComposants > 0
                  ? `${choisi.nbComposants} composant(s) directs dans la nomenclature.`
                  : "⚠️ Nomenclature vide : ce produit ne peut pas être trié, il partira sur la chaîne ADMEDCO complète."}
              </p>
            )}
          </div>
        </div>
      </GlassCard>

      {rapport && !rapport.ok && (
        <div className="card border-red-200 bg-red-50 p-4 text-sm text-red-600">{rapport.message}</div>
      )}

      {rapport?.ok && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat
              label="Ordres de fabrication"
              value={String(rapport.parts.length)}
              accent="ice"
              sub={rapport.parts.map((p) => p.usineCode).join(" + ")}
            />
            <Stat label="Étapes au total" value={String(totalEtapes)} sub={`pour ${rapport.produit?.code ?? ""}`} />
            <Stat
              label="Matières engagées"
              value={String(rapport.matieres.length)}
              accent="green"
              sub="éclatées jusqu'aux matières premières"
            />
            <Stat
              label="Matières manquantes"
              value={String(rapport.manquants.length)}
              accent={rapport.manquants.length > 0 ? "red" : undefined}
              sub={rapport.manquants.length > 0 ? "à couvrir avant lancement" : "stock suffisant"}
            />
          </div>

          <div className="card flex flex-wrap items-center gap-3 p-4">
            <Route size={16} className="text-[#4a7c59]" />
            <p className="flex-1 text-sm">
              <strong>{rapport.produit?.code}</strong> — {rapport.produit?.designation} ×{quantite}
            </p>
            <span className="text-[12px] text-[#7c8091]">{rapport.message}</span>
          </div>

          {/* ── Les ordres de fabrication que le lancement créerait ── */}
          {rapport.parts.map((part, i) => (
            <GlassCard key={`${part.usineCode}-${i}`}>
              <SectionTitle
                kicker={`Ordre ${i + 1} — usine ${part.usineCode}`}
                title={`${part.nbEtapes} étape(s) sur ${part.ateliers.length} atelier(s)`}
                hint={PARCOURS_FR[part.parcours] ?? part.parcours}
                right={
                  <span className="rounded-full bg-[#1a1d23] px-3 py-1 text-[11px] font-bold text-white">
                    {part.parcours}
                  </span>
                }
              />

              <div className="mb-4 flex flex-wrap gap-2">
                {part.ateliers.map((a) => (
                  <span
                    key={a.atelierId}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-[#f8f7f5] px-3 py-1.5 text-[12px]"
                  >
                    <Factory size={13} className="text-[#7c8091]" />
                    <strong>{a.nom}</strong>
                    <span className="text-[#7c8091]">{a.nbEtapes} étape(s)</span>
                  </span>
                ))}
              </div>

              <p className="mb-4 flex items-start gap-2 rounded-xl bg-[#f8f7f5] p-3 text-[12px] text-[#4b4f58]">
                <PackageOpen size={14} className="mt-0.5 shrink-0 text-[#7c8091]" />
                {DESTINATION_FR[part.destination] ?? part.destination}
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-widest text-[#7c8091]">
                      <th className="py-2">Séquence</th>
                      <th className="py-2">Atelier</th>
                      <th className="py-2">N° atelier</th>
                      <th className="py-2">Code</th>
                      <th className="py-2">Opération</th>
                      <th className="py-2">Dépôt de sortie</th>
                    </tr>
                  </thead>
                  <tbody>
                    {part.etapes.map((e) => (
                      <tr key={`${e.sequence}-${e.code}`} className="border-t border-black/5">
                        <td className="py-2 font-black tabular-nums text-[#c24a08]">{e.sequence}</td>
                        <td className="py-2 text-xs">{e.atelier}</td>
                        <td className="py-2 tabular-nums">{e.ordreAtelier}</td>
                        <td className="py-2 font-mono text-[12px] text-[#7c8091]">{e.code}</td>
                        <td className="py-2 font-medium">{e.nom}</td>
                        <td className="py-2 font-mono text-[12px]">{e.depotSortie ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {part.composants.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">
                    Composants rattachés à cette usine par le triage ({part.composants.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {part.composants.map((c) => (
                      <span key={c.code} className="rounded-lg bg-[#f3f0eb] px-2 py-1 text-[11px]">
                        <strong>{c.code}</strong> {c.designation}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </GlassCard>
          ))}

          {/* ── Matière ── */}
          <GlassCard>
            <SectionTitle
              kicker="Agent matière"
              title="Matières engagées par la commande"
              hint="Éclatement multi-niveaux de la nomenclature, puis application du rendement matière. « Rendement » = pièces obtenues par unité de matière."
              right={
                <span className="inline-flex items-center gap-1 text-xs text-[#7c8091]">
                  <FlaskConical size={13} /> {rapport.matieres.length} matière(s)
                </span>
              }
            />
            {rapport.matieres.length === 0 ? (
              <Empty
                icon="🧾"
                title="Aucune matière calculée"
                hint="La nomenclature de ce produit est vide : rien à éclater."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-widest text-[#7c8091]">
                      <th className="py-2">Code</th>
                      <th className="py-2">Désignation</th>
                      <th className="py-2 text-right">Besoin brut</th>
                      <th className="py-2 text-right">Rendement</th>
                      <th className="py-2 text-right">Besoin net</th>
                      <th className="py-2">Unité</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rapport.matieres.map((m) => {
                      const manque = rapport.manquants.some((x) => x.code === m.code);
                      return (
                        <tr key={m.code} className={`border-t border-black/5 ${manque ? "bg-red-50/40" : ""}`}>
                          <td className="py-2 font-mono text-[12px]">{m.code}</td>
                          <td className="py-2">{m.designation}</td>
                          <td className="py-2 text-right tabular-nums">{d3(m.brut)}</td>
                          <td className="py-2 text-right tabular-nums">
                            {m.rendementRenseigne ? `÷ ${d3(m.rendement)}` : <span className="text-amber-600">1 pour 1 (non renseigné)</span>}
                          </td>
                          <td className="py-2 text-right font-bold tabular-nums">{d3(m.net)}</td>
                          <td className="py-2 text-xs text-[#7c8091]">{m.unite}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {rapport.manquants.length > 0 && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="mb-2 flex items-center gap-2 text-[12px] font-bold text-red-600">
                  <AlertTriangle size={14} /> {rapport.manquants.length} matière(s) non couverte(s) par le stock
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {rapport.manquants.map((m) => (
                    <span key={m.code} className="rounded-lg border border-red-200 bg-white px-2 py-1 text-[11px]">
                      <strong>{m.code}</strong> manque {d3(m.manque)} {m.unite}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-[#7c8091]">
                  Le lancement reste possible : ce qui manque ne bloque pas, il devient une dette de production reprise par la commande suivante.
                </p>
              </div>
            )}
          </GlassCard>

          {/* ── Composants que le triage n'a pas su rattacher ── */}
          {rapport.nonClassee.length > 0 && (
            <GlassCard>
              <SectionTitle
                kicker="Point de vigilance"
                title={`${rapport.nonClassee.length} composant(s) non rattaché(s) à une usine`}
                hint="Le triage les classe par mots-clés de désignation. Ceux-ci n'évoquent ni le dur ni le mou : ils suivent la part ADMEDCO sans être comptés dans son explication."
              />
              <div className="flex flex-wrap gap-1.5">
                {rapport.nonClassee.map((c) => (
                  <span key={c.code} className="rounded-lg bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
                    <strong>{c.code}</strong> {c.designation}
                  </span>
                ))}
              </div>
            </GlassCard>
          )}

          {rapport.avertissements.length > 0 && (
            <GlassCard>
              <SectionTitle kicker="Référentiel" title="Avertissements de lecture" />
              <ul className="space-y-1 text-[13px] text-amber-700">
                {rapport.avertissements.map((a, i) => (
                  <li key={i}>• {a}</li>
                ))}
              </ul>
            </GlassCard>
          )}
        </>
      )}
    </div>
  );
}
