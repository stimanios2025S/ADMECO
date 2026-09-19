"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, CheckCircle2, Package, Phone } from "lucide-react";
import { soumettreCommandePortail } from "@/app/actions-workflow";

type Ligne = { articleId: string | null; designation: string; quantite: number; prixUnitaire: number };

// ═══════════════════════════════════════════════════════════
// PORTAIL CLIENT — l'écran que voit le client sur son téléphone
//
// Trois choses, dans cet ordre : le catalogue, le panier, l'envoi.
// Le client n'a pas de compte, ne voit aucun prix d'achat, aucun
// stock, aucun atelier. Une seule commande : la sienne.
// ═══════════════════════════════════════════════════════════

export default function PortailClient({
  token,
  numero,
  statut,
  ferme,
  client,
  lignesInitiales,
  catalogue,
}: {
  token: string;
  numero: string;
  statut: string;
  ferme: boolean;
  client: { nom: string; telephone: string; email: string; adresse: string; note: string };
  lignesInitiales: Ligne[];
  catalogue: Array<{ id: string; code: string; designation: string; unite: string; prix: number }>;
}) {
  const [pending, start] = useTransition();
  const [info, setInfo] = useState(client);
  const [lignes, setLignes] = useState<Ligne[]>(
    lignesInitiales.length > 0 ? lignesInitiales : [],
  );
  const [recherche, setRecherche] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);

  const filtres = catalogue.filter((a) => {
    const q = recherche.trim().toLowerCase();
    if (!q) return true;
    return `${a.code} ${a.designation}`.toLowerCase().includes(q);
  }).slice(0, 60);

  const ajouter = (a: { id: string; code: string; designation: string; prix: number }) => {
    setLignes((l) => {
      const i = l.findIndex((x) => x.articleId === a.id);
      if (i >= 0) return l.map((x, j) => (j === i ? { ...x, quantite: x.quantite + 1 } : x));
      return [...l, { articleId: a.id, designation: `${a.code} — ${a.designation}`, quantite: 1, prixUnitaire: a.prix }];
    });
  };

  const envoyer = () => {
    setMessage(null);
    start(async () => {
      const r = await soumettreCommandePortail({
        token,
        clientNom: info.nom,
        clientTelephone: info.telephone,
        clientEmail: info.email,
        clientAdresse: info.adresse,
        note: info.note,
        lignes: lignes.map((l) => ({
          articleId: l.articleId,
          designation: l.designation,
          quantite: Number(l.quantite) || 0,
          prixUnitaire: Number(l.prixUnitaire) || 0,
        })),
      });
      setMessage({ ok: r.ok, texte: r.message });
    });
  };

  const total = lignes.reduce((n, l) => n + (Number(l.quantite) || 0) * (Number(l.prixUnitaire) || 0), 0);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#7c8091]">ADMEDCO · MOBILIX</p>
        <h1 className="text-2xl font-extrabold tracking-tight">Votre commande {numero}</h1>
        <p className="mt-1 text-sm text-[#7c8091]">
          Choisissez vos produits, indiquez les quantités, puis envoyez. Nous vous rappelons pour confirmer le délai.
        </p>
      </header>

      {message && (
        <div className={`card mb-5 flex items-start gap-2 p-4 text-sm ${message.ok ? "border-[#4a7c59]/30 bg-[#4a7c59]/5 text-[#2f5a3c]" : "border-red-200 bg-red-50 text-red-600"}`}>
          {message.ok && <CheckCircle2 size={16} className="mt-0.5 shrink-0" />}
          <span>{message.texte}</span>
        </div>
      )}

      {ferme && (
        <div className="card mb-5 border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          Cette commande est déjà en traitement : elle ne peut plus être modifiée en ligne. Appelez-nous pour tout changement.
        </div>
      )}

      {!ferme && (
        <>
          <section className="card mb-5 p-4">
            <h2 className="mb-3 text-sm font-extrabold">1. Vos coordonnées</h2>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <input className="input" placeholder="Votre nom *" value={info.nom} onChange={(e) => setInfo({ ...info, nom: e.target.value })} />
              <input className="input" placeholder="Téléphone" value={info.telephone} onChange={(e) => setInfo({ ...info, telephone: e.target.value })} />
              <input className="input" placeholder="E-mail" value={info.email} onChange={(e) => setInfo({ ...info, email: e.target.value })} />
              <input className="input" placeholder="Adresse de livraison" value={info.adresse} onChange={(e) => setInfo({ ...info, adresse: e.target.value })} />
            </div>
          </section>

          <section className="card mb-5 p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold">
              <Package size={15} /> 2. Le catalogue
            </h2>
            <input
              className="input mb-3"
              placeholder="Rechercher un produit (chaise, bureau, table…)"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
            <div className="space-y-1.5">
              {filtres.map((a) => (
                <button
                  key={a.id}
                  onClick={() => ajouter(a)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-black/5 bg-[#f8f7f5] p-3 text-left transition hover:border-[#c24a08]/30 hover:bg-[#c24a08]/5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{a.code} — {a.designation}</span>
                    <span className="text-xs text-[#7c8091]">unité : {a.unite}</span>
                  </span>
                  <span className="shrink-0 text-[#c24a08]">
                    <Plus size={16} />
                  </span>
                </button>
              ))}
              {filtres.length === 0 && (
                <p className="rounded-xl border border-dashed border-black/10 p-4 text-center text-xs text-[#7c8091]">
                  Aucun produit ne correspond. Décrivez ce que vous cherchez dans la note, nous vous répondrons.
                </p>
              )}
            </div>
          </section>

          <section className="card mb-5 p-4">
            <h2 className="mb-3 text-sm font-extrabold">3. Votre panier</h2>
            {lignes.length === 0 ? (
              <p className="rounded-xl border border-dashed border-black/10 p-4 text-center text-xs text-[#7c8091]">
                Votre panier est vide. Touchez un produit ci-dessus pour l'ajouter.
              </p>
            ) : (
              <div className="space-y-2">
                {lignes.map((l, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      className="input flex-1"
                      value={l.designation}
                      onChange={(e) => setLignes((x) => x.map((y, j) => (j === i ? { ...y, designation: e.target.value } : y)))}
                    />
                    <input
                      className="input w-20"
                      type="number"
                      min={1}
                      value={l.quantite}
                      onChange={(e) => setLignes((x) => x.map((y, j) => (j === i ? { ...y, quantite: Number(e.target.value) } : y)))}
                    />
                    <button className="btn-ghost p-2 text-red-500" onClick={() => setLignes((x) => x.filter((_, j) => j !== i))} title="Retirer">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <p className="pt-1 text-right text-sm font-extrabold">
                  {lignes.reduce((n, l) => n + (Number(l.quantite) || 0), 0)} pièce(s)
                  {total > 0 ? ` · ${total.toLocaleString("fr-FR")} DA` : ""}
                </p>
              </div>
            )}

            <input
              className="input mt-3"
              placeholder="Précisions : teinte, délai souhaité, lieu de livraison…"
              value={info.note}
              onChange={(e) => setInfo({ ...info, note: e.target.value })}
            />

            <button
              onClick={envoyer}
              disabled={pending || lignes.length === 0 || !info.nom.trim()}
              className="btn-fire mt-4 w-full px-4 py-3 text-sm disabled:opacity-50"
            >
              {pending ? "Envoi en cours…" : "Envoyer ma commande"}
            </button>
            <p className="mt-2 text-center text-[11px] text-[#9aa0ab]">
              L'envoi ne déclenche aucun paiement. ADMEDCO vous rappelle pour confirmer.
            </p>
          </section>
        </>
      )}

      {ferme && lignes.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-3 text-sm font-extrabold">Votre commande</h2>
          <div className="space-y-1">
            {lignes.map((l, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="truncate">{l.designation}</span>
                <span className="ml-3 shrink-0 font-bold">×{l.quantite}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-[#7c8091]">Statut : {statut}</p>
        </section>
      )}

      <footer className="mt-8 flex items-center justify-center gap-2 text-xs text-[#7c8091]">
        <Phone size={12} /> Une question ? Appelez ADMEDCO — nous suivons votre commande de la tôle au tapissage.
      </footer>
    </main>
  );
}
