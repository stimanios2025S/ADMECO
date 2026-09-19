"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calculator, FlaskConical, Pencil, Plus, Save, X } from "lucide-react";
import { GlassCard, SectionTitle, Stat, Empty, StatusPill } from "@/components/admin/ui";
import { enregistrerRendement, nomenclatureProduit } from "@/app/actions-workflow";

type Article = { id: string; code: string; designation: string; unite: string };

type Rendement = {
  id: string;
  usine: string;
  articleId: string;
  produitId: string | null;
  unitesProduites: number;
  uniteMatiere: string;
  uniteProduit: string;
  note: string;
  actif: boolean;
};

type Besoin = {
  code: string;
  designation: string;
  brut: number;
  net: number;
  rendement: number;
  rendementRenseigne: boolean;
  unite: string;
  niveau: number;
};

type Form = {
  usine: "ADMEDCO" | "MOBILIX";
  articleId: string;
  produitId: string;
  unitesProduites: string;
  uniteMatiere: string;
  uniteProduit: string;
  note: string;
};

const FORM_VIDE: Form = {
  usine: "ADMEDCO",
  articleId: "",
  produitId: "",
  unitesProduites: "1",
  uniteMatiere: "pcs",
  uniteProduit: "pcs",
  note: "",
};

export default function PageClient({
  rendements,
  matieres,
  produits,
  erreur,
  avertissement,
}: {
  rendements: Rendement[];
  matieres: Article[];
  produits: Article[];
  erreur: string | null;
  avertissement: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [form, setForm] = useState<Form>(FORM_VIDE);
  const [edition, setEdition] = useState<string | null>(null);
  const [filtreUsine, setFiltreUsine] = useState("");
  const [chercheMatiere, setChercheMatiere] = useState("");
  const [chercheProduit, setChercheProduit] = useState("");

  // ── Vérification : « pour 1 chaise, il me faut combien de barres ? » ──
  const [verifProduit, setVerifProduit] = useState("");
  const [verifUsine, setVerifUsine] = useState<"ADMEDCO" | "MOBILIX">("ADMEDCO");
  const [verif, setVerif] = useState<{ besoins: Besoin[]; manquants: Array<{ code: string; manque: number; unite: string }>; message: string; ok: boolean } | null>(null);

  const nomArticle = useMemo(() => {
    const m = new Map<string, Article>();
    for (const a of [...matieres, ...produits]) m.set(a.id, a);
    return m;
  }, [matieres, produits]);

  const libelle = (id: string | null) => {
    if (!id) return "— tous les produits —";
    const a = nomArticle.get(id);
    return a ? `${a.code} — ${a.designation}` : "(article supprimé)";
  };

  const rendusFiltres = useMemo(
    () => (filtreUsine ? rendements.filter((r) => r.usine === filtreUsine) : rendements),
    [rendements, filtreUsine],
  );

  const matieresFiltrees = useMemo(() => {
    const q = chercheMatiere.trim().toLowerCase();
    const l = q ? matieres.filter((a) => `${a.code} ${a.designation}`.toLowerCase().includes(q)) : matieres;
    return l.slice(0, 400);
  }, [matieres, chercheMatiere]);

  const produitsFiltres = useMemo(() => {
    const q = chercheProduit.trim().toLowerCase();
    const l = q ? produits.filter((a) => `${a.code} ${a.designation}`.toLowerCase().includes(q)) : produits;
    return l.slice(0, 400);
  }, [produits, chercheProduit]);

  const parUsine = useMemo(() => {
    const c = { ADMEDCO: 0, MOBILIX: 0 };
    for (const r of rendements) {
      if (r.usine === "MOBILIX") c.MOBILIX += 1;
      else c.ADMEDCO += 1;
    }
    return c;
  }, [rendements]);

  const enregistrer = () => {
    setMessage(null);
    if (!form.articleId) {
      setMessage({ ok: false, texte: "Choisissez d'abord la matière première concernée." });
      return;
    }
    if (!(Number(form.unitesProduites) > 0)) {
      setMessage({ ok: false, texte: "Le rendement doit être supérieur à zéro (ex. 4 si 1 barre fait 4 pièces)." });
      return;
    }
    start(async () => {
      const r = await enregistrerRendement({
        usineCode: form.usine,
        articleId: form.articleId,
        produitId: form.produitId || null,
        unitesProduites: Number(form.unitesProduites),
        uniteMatiere: form.uniteMatiere || "pcs",
        uniteProduit: form.uniteProduit || "pcs",
        note: form.note,
      });
      setMessage({ ok: r.ok, texte: r.message });
      if (r.ok) {
        setForm({ ...FORM_VIDE, usine: form.usine });
        setEdition(null);
        router.refresh();
      }
    });
  };

  const basculerEdition = (r: Rendement) => {
    setMessage(null);
    setEdition(r.id);
    setForm({
      usine: r.usine === "MOBILIX" ? "MOBILIX" : "ADMEDCO",
      articleId: r.articleId,
      produitId: r.produitId ?? "",
      unitesProduites: String(r.unitesProduites),
      uniteMatiere: r.uniteMatiere,
      uniteProduit: r.uniteProduit,
      note: r.note,
    });
    setChercheMatiere("");
    setChercheProduit("");
  };

  const verifier = () => {
    if (!verifProduit) {
      setMessage({ ok: false, texte: "Choisissez le produit à vérifier." });
      return;
    }
    setMessage(null);
    start(async () => {
      const r = await nomenclatureProduit({ produitId: verifProduit, usine: verifUsine });
      setVerif({ ok: r.ok, besoins: r.besoins, manquants: r.manquants, message: r.message });
    });
  };

  return (
    <div className="stagger space-y-5">
      {erreur && <div className="card border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">{erreur}</div>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Rendements saisis" value={String(rendements.length)} accent="ice" sub="Toutes usines" />
        <Stat label="ADMEDCO" value={String(parUsine.ADMEDCO)} sub="Matières renseignées" />
        <Stat label="MOBILIX" value={String(parUsine.MOBILIX)} sub="Matières renseignées" />
        <Stat
          label="Avec produit précis"
          value={String(rendements.filter((r) => r.produitId).length)}
          sub={`sur ${rendements.length} — le reste vaut pour tous`}
        />
      </div>

      {avertissement && (
        <div className="card border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">{avertissement}</div>
      )}

      {message && (
        <div className={`card p-4 text-sm ${message.ok ? "border-[#4a7c59]/30 bg-[#4a7c59]/5 text-[#2f5a3c]" : "border-red-200 bg-red-50 text-red-600"}`}>
          {message.texte}
        </div>
      )}

      {/* ═══════════ SAISIE ═══════════ */}
      <GlassCard>
        <SectionTitle
          kicker={edition ? "Correction" : "Nouveau"}
          title={edition ? "Modifier un rendement" : "Saisir un rendement"}
          hint="« Une unité de cette matière donne N pièces. » Laissez le produit vide si le rendement vaut pour tous les produits de l'usine — les deux sont permis, le rendement précis l'emporte."
          right={
            edition ? (
              <button
                onClick={() => {
                  setEdition(null);
                  setForm({ ...FORM_VIDE, usine: form.usine });
                }}
                className="btn-ghost inline-flex items-center gap-1 px-3 py-1.5 text-xs"
              >
                <X size={13} /> Annuler la correction
              </button>
            ) : undefined
          }
        />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Usine</span>
            <select
              className="input mt-1"
              value={form.usine}
              onChange={(e) => setForm({ ...form, usine: e.target.value as "ADMEDCO" | "MOBILIX" })}
            >
              <option value="ADMEDCO">ADMEDCO</option>
              <option value="MOBILIX">MOBILIX</option>
            </select>
          </label>

          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">
              Unité de matière donne
            </span>
            <input
              className="input mt-1"
              type="number"
              min={0.0001}
              step="any"
              value={form.unitesProduites}
              onChange={(e) => setForm({ ...form, unitesProduites: e.target.value })}
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Unité de matière</span>
            <input
              className="input mt-1"
              value={form.uniteMatiere}
              onChange={(e) => setForm({ ...form, uniteMatiere: e.target.value })}
              placeholder="barre, tôle, m…"
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Unité de pièce</span>
            <input
              className="input mt-1"
              value={form.uniteProduit}
              onChange={(e) => setForm({ ...form, uniteProduit: e.target.value })}
              placeholder="pcs"
            />
          </label>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Matière première *</span>
            <input
              className="input mt-1"
              placeholder="Filtrer (code ou désignation)…"
              value={chercheMatiere}
              onChange={(e) => setChercheMatiere(e.target.value)}
            />
            <select
              className="input mt-2"
              value={form.articleId}
              onChange={(e) => setForm({ ...form, articleId: e.target.value })}
            >
              <option value="">— choisir la matière —</option>
              {matieresFiltrees.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.designation}
                </option>
              ))}
            </select>
            {matieres.length > matieresFiltrees.length && (
              <p className="mt-1 text-[11px] text-[#9aa0ab]">
                {matieresFiltrees.length} affichés sur {matieres.length} — affinez le filtre.
              </p>
            )}
          </div>

          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">
              Produit concerné (facultatif)
            </span>
            <input
              className="input mt-1"
              placeholder="Filtrer (code ou désignation)…"
              value={chercheProduit}
              onChange={(e) => setChercheProduit(e.target.value)}
            />
            <select
              className="input mt-2"
              value={form.produitId}
              onChange={(e) => setForm({ ...form, produitId: e.target.value })}
            >
              <option value="">— tous les produits de l'usine —</option>
              {produitsFiltres.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.designation}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="mt-3 block">
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Note (d'où vient la valeur)</span>
          <input
            className="input mt-1"
            placeholder="Ex. mesuré à l'atelier le 12/03, atelier 2"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </label>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-[#7c8091]">
            {form.articleId ? (
              <>
                1 {form.uniteMatiere || "unité"} de <strong>{libelle(form.articleId)}</strong> →{" "}
                <strong>{form.unitesProduites || "—"} {form.uniteProduit || "pcs"}</strong>
                {form.produitId ? <> , pour <strong>{libelle(form.produitId)}</strong></> : " , pour tous les produits"}
              </>
            ) : (
              "Choisissez la matière pour voir la phrase du rendement."
            )}
          </p>
          <button onClick={enregistrer} disabled={pending} className="btn-fire inline-flex items-center gap-1 px-4 py-2 text-sm disabled:opacity-50">
            {edition ? <Save size={14} /> : <Plus size={14} />}
            {pending ? "Enregistrement…" : edition ? "Enregistrer la correction" : "Ajouter le rendement"}
          </button>
        </div>
      </GlassCard>

      {/* ═══════════ VÉRIFICATION ═══════════ */}
      <GlassCard>
        <SectionTitle
          kicker="Le contrôle"
          title="Vérifier l'effet sur un produit"
          hint="Choisissez un produit : l'agent éclate sa nomenclature et applique les rendements. C'est exactement le calcul qui décidera de la matière réservée à la commande."
        />
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Usine</span>
            <select className="input mt-1 w-40" value={verifUsine} onChange={(e) => setVerifUsine(e.target.value as "ADMEDCO" | "MOBILIX")}>
              <option value="ADMEDCO">ADMEDCO</option>
              <option value="MOBILIX">MOBILIX</option>
            </select>
          </label>
          <label className="block min-w-[260px] flex-1">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Produit</span>
            <select className="input mt-1" value={verifProduit} onChange={(e) => setVerifProduit(e.target.value)}>
              <option value="">— choisir un produit fabriqué —</option>
              {produitsFiltres.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.designation}
                </option>
              ))}
            </select>
          </label>
          <button onClick={verifier} disabled={pending} className="btn-ghost inline-flex items-center gap-1 px-4 py-2 text-sm disabled:opacity-50">
            <Calculator size={14} /> Calculer
          </button>
        </div>

        {verif && (
          <div className="mt-4">
            {!verif.ok ? (
              <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{verif.message}</p>
            ) : verif.besoins.length === 0 ? (
              <p className="rounded-xl border border-dashed border-black/10 p-4 text-center text-xs text-[#7c8091]">
                Aucune nomenclature trouvée pour ce produit. Renseignez-la dans /admin/nomenclatures.
              </p>
            ) : (
              <>
                <p className="mb-2 text-xs text-[#7c8091]">
                  Pour <strong>1 pièce</strong> : {verif.besoins.length} matière(s) consommée(s).
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-widest text-[#7c8091]">
                        <th className="py-2">Matière</th>
                        <th className="py-2 text-right">Brut (nomenclature)</th>
                        <th className="py-2 text-right">Rendement</th>
                        <th className="py-2 text-right">Net à sortir</th>
                        <th className="py-2 text-right">Unité</th>
                      </tr>
                    </thead>
                    <tbody>
                      {verif.besoins.map((b, i) => (
                        <tr key={`${b.code}-${i}`} className="border-t border-black/5">
                          <td className="py-2">
                            <span className="block font-bold">{b.code}</span>
                            <span className="block text-[11px] text-[#7c8091]">{b.designation}</span>
                          </td>
                          <td className="py-2 text-right tabular-nums">{arrondi(b.brut)}</td>
                          <td className="py-2 text-right">
                            {b.rendementRenseigne ? (
                              <span className="tabular-nums">{arrondi(b.rendement)}</span>
                            ) : (
                              <StatusPill status="SOUS_SEUIL" />
                            )}
                          </td>
                          <td className="py-2 text-right font-black tabular-nums text-[#c24a08]">{arrondi(b.net)}</td>
                          <td className="py-2 text-right text-xs text-[#7c8091]">{b.unite}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {verif.besoins.some((b) => !b.rendementRenseigne) && (
                  <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                    Les lignes en rouge sont calculées <strong>1 pour 1</strong> faute de rendement saisi. Tant que
                    ce n'est pas renseigné, le nombre de barres à sortir du stock sera faux — jamais inventé.
                  </p>
                )}
                {verif.manquants.length > 0 && (
                  <p className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">
                    {verif.manquants.length} matière(s) en manque :{" "}
                    {verif.manquants.map((m) => `${m.code} (−${arrondi(m.manque)} ${m.unite})`).join(", ")}.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </GlassCard>

      {/* ═══════════ TABLE ═══════════ */}
      <GlassCard>
        <SectionTitle
          kicker="Ce qui est renseigné"
          title="Rendements en base"
          hint="Le rendement précis (un produit) l'emporte sur le rendement global (tous les produits)."
          right={
            <select className="input w-40" value={filtreUsine} onChange={(e) => setFiltreUsine(e.target.value)}>
              <option value="">Toutes usines</option>
              <option value="ADMEDCO">ADMEDCO</option>
              <option value="MOBILIX">MOBILIX</option>
            </select>
          }
        />
        {rendusFiltres.length === 0 ? (
          <Empty
            icon="🧪"
            title="Aucun rendement saisi"
            hint="C'est normal au départ : la table démarre vide. Chaque valeur viendra de l'usine. En attendant, l'agent travaille en 1 pour 1 et le signale à chaque calcul."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-widest text-[#7c8091]">
                  <th className="py-2">Usine</th>
                  <th className="py-2">Matière</th>
                  <th className="py-2">Produit</th>
                  <th className="py-2 text-right">Rendement</th>
                  <th className="py-2">Note</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rendusFiltres.map((r) => (
                  <tr key={r.id} className="border-t border-black/5">
                    <td className="py-2 text-xs font-bold">{r.usine}</td>
                    <td className="py-2">{libelle(r.articleId)}</td>
                    <td className="py-2 text-xs text-[#7c8091]">{libelle(r.produitId)}</td>
                    <td className="py-2 text-right tabular-nums">
                      1 {r.uniteMatiere} → <strong>{arrondi(r.unitesProduites)}</strong> {r.uniteProduit}
                    </td>
                    <td className="py-2 text-xs text-[#7c8091]">{r.note || "—"}</td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => basculerEdition(r)}
                        className="btn-ghost inline-flex items-center gap-1 px-3 py-1.5 text-xs"
                      >
                        <Pencil size={12} /> Corriger
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <p className="flex items-start gap-2 rounded-2xl border border-dashed border-black/10 bg-[#f8f7f5] p-4 text-xs text-[#7c8091]">
        <FlaskConical size={14} className="mt-0.5 shrink-0" />
        <span>
          Un rendement se mesure, il ne se devine pas : prenez une unité de matière, comptez les pièces conformes
          qui en sortent réellement, et saisissez ce nombre. Une valeur fausse fera sortir trop ou pas assez de
          stock — mieux vaut laisser la ligne vide, l'agent le signalera.
        </span>
      </p>
    </div>
  );
}

const arrondi = (n: number): string => {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 1000) / 1000);
};
