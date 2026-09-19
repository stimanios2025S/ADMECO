"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Link2, GitBranch, Copy, Check } from "lucide-react";
import { GlassCard, SectionTitle, Stat, StatusPill, Empty } from "@/components/admin/ui";
import { creerCommandeClient, trierEtLancerCommande, changerStatutCommande } from "@/app/actions-workflow";

type Ligne = { articleId: string | null; designation: string; quantite: number; prixUnitaire: number };

const STATUTS_A_TRIER = ["BROUILLON", "RECUE"];

export default function PageClient({
  commandes,
  catalogue,
  baseUrl,
  erreur,
}: {
  commandes: any[];
  catalogue: Array<{ id: string; code: string; designation: string; unite: string; prix: number }>;
  baseUrl: string;
  erreur: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [copie, setCopie] = useState<string | null>(null);

  const [client, setClient] = useState({ nom: "", telephone: "", email: "", adresse: "", note: "" });
  const [lignes, setLignes] = useState<Ligne[]>([{ articleId: null, designation: "", quantite: 1, prixUnitaire: 0 }]);

  const stats = useMemo(() => {
    const aTrier = commandes.filter((c) => STATUTS_A_TRIER.includes(c.statut)).length;
    const enProd = commandes.filter((c) => ["TRIEE", "EN_PRODUCTION", "PARTIELLE"].includes(c.statut)).length;
    const livrees = commandes.filter((c) => c.statut === "LIVREE").length;
    const pieces = commandes.reduce(
      (n, c) => n + (c.lignes ?? []).reduce((m: number, l: any) => m + (Number(l.quantite) || 0), 0),
      0,
    );
    return { aTrier, enProd, livrees, pieces };
  }, [commandes]);

  const choisirArticle = (idx: number, articleId: string) => {
    const art = catalogue.find((a) => a.id === articleId);
    setLignes((l) =>
      l.map((x, i) =>
        i === idx
          ? {
              ...x,
              articleId: art?.id ?? null,
              designation: art ? `${art.code} — ${art.designation}` : "",
              prixUnitaire: art?.prix ?? 0,
            }
          : x,
      ),
    );
  };

  const creer = () => {
    setMessage(null);
    start(async () => {
      const r = await creerCommandeClient({
        clientNom: client.nom,
        clientTelephone: client.telephone,
        clientEmail: client.email,
        clientAdresse: client.adresse,
        note: client.note,
        origine: "SAISIE_ADMIN",
        lignes: lignes.map((l) => ({
          articleId: l.articleId,
          designation: l.designation,
          quantite: Number(l.quantite) || 0,
          prixUnitaire: Number(l.prixUnitaire) || 0,
        })),
      });
      setMessage({ ok: r.ok, texte: r.message });
      if (r.ok) {
        setOpen(false);
        setClient({ nom: "", telephone: "", email: "", adresse: "", note: "" });
        setLignes([{ articleId: null, designation: "", quantite: 1, prixUnitaire: 0 }]);
        router.refresh();
      }
    });
  };

  const trier = (commandeId: string) => {
    setMessage(null);
    setDetail(null);
    start(async () => {
      const r = await trierEtLancerCommande({ commandeId });
      setMessage({ ok: r.ok, texte: r.message });
      setDetail(r.ok ? r : null);
      if (r.ok) router.refresh();
    });
  };

  const changer = (commandeId: string, statut: any) => {
    setMessage(null);
    start(async () => {
      const r = await changerStatutCommande({ commandeId, statut });
      setMessage({ ok: r.ok, texte: r.message });
      if (r.ok) router.refresh();
    });
  };

  const copierLien = async (token: string) => {
    const url = `${baseUrl}/commande/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopie(token);
      setTimeout(() => setCopie(null), 2500);
    } catch {
      setMessage({ ok: false, texte: `Copiez ce lien : ${url}` });
    }
  };

  const totalLignes = lignes.reduce((n, l) => n + (Number(l.quantite) || 0) * (Number(l.prixUnitaire) || 0), 0);

  return (
    <div className="stagger space-y-5">
      {erreur && (
        <div className="card border-red-200 bg-red-50 p-4 text-sm text-red-600">
          Lecture incomplète : {erreur} — la migration 0017 doit être exécutée sur le serveur.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="À trier" value={String(stats.aTrier)} accent="fire" sub="Reçues, pas encore réparties" />
        <Stat label="En production" value={String(stats.enProd)} accent="ice" sub="Triées ou lancées" />
        <Stat label="Livrées" value={String(stats.livrees)} accent="green" />
        <Stat label="Pièces commandées" value={String(stats.pieces)} sub="Toutes commandes confondues" />
      </div>

      {message && (
        <div className={`card p-4 text-sm ${message.ok ? "border-[#4a7c59]/30 bg-[#4a7c59]/5 text-[#2f5a3c]" : "border-red-200 bg-red-50 text-red-600"}`}>
          {message.texte}
        </div>
      )}

      {detail?.sousCommandes?.length > 0 && (
        <GlassCard>
          <SectionTitle kicker="Triage" title="Sous-commandes créées" hint="Une ligne par usine — jamais mélangées, toujours reliées à la commande." />
          <div className="space-y-1.5">
            {detail.sousCommandes.map((s: any) => (
              <div key={s.itemId} className="flex items-center gap-3 rounded-xl border border-black/5 bg-[#f8f7f5] p-3">
                <span className="rounded-full border border-black/10 bg-white px-2.5 py-0.5 text-[11px] font-bold">{s.usine}</span>
                <span className="text-sm font-bold">{s.etapes} étapes</span>
                <span className="text-xs text-[#7c8091]">usine {s.usine}</span>
              </div>
            ))}
          </div>
          {detail.nonClassee?.length > 0 && (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
              {detail.nonClassee.length} composant(s) sans usine reconnue : {detail.nonClassee.map((n: any) => n.code).join(", ")}.
              Ils n'ont pas été perdus — mais confirmez leur atelier.
            </p>
          )}
        </GlassCard>
      )}

      <GlassCard>
        <SectionTitle
          kicker="Commercial"
          title="Commandes"
          hint="Créer pour un client, copier son lien, puis trier et lancer la production."
          right={
            <button onClick={() => setOpen(true)} className="btn-fire inline-flex items-center gap-1 px-4 py-2 text-sm">
              <Plus size={15} /> Nouvelle commande
            </button>
          }
        />

        {commandes.length === 0 ? (
          <Empty
            icon="🧾"
            title="Aucune commande client"
            hint="Créez la première, ou envoyez un lien à votre client pour qu'il remplisse lui-même."
          />
        ) : (
          <div className="space-y-2">
            {commandes.map((c) => (
              <div key={c.id} className="card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold">{c.numero}</span>
                      <StatusPill status={c.statut} />
                      <span className="rounded-full border border-black/10 bg-[#f8f7f5] px-2 py-0.5 text-[11px] font-semibold text-[#7c8091]">
                        {c.origine === "PORTAIL_CLIENT" ? "Portail client" : "Saisie admin"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-bold">{c.client_nom}</p>
                    <p className="text-xs text-[#7c8091]">
                      {(c.lignes ?? []).length} ligne(s) ·{" "}
                      {(c.lignes ?? []).reduce((n: number, l: any) => n + (Number(l.quantite) || 0), 0)} pièce(s) ·{" "}
                      {Number(c.total_estime) > 0 ? `${Number(c.total_estime).toLocaleString("fr-FR")} DA` : "prix non saisi"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => copierLien(c.token)}
                      className="btn-ghost inline-flex items-center gap-1 px-3 py-2 text-xs"
                      title="Lien à envoyer au client"
                    >
                      {copie === c.token ? <Check size={13} /> : <Link2 size={13} />}
                      {copie === c.token ? "Copié" : "Lien client"}
                    </button>
                    {STATUTS_A_TRIER.includes(c.statut) && (
                      <button
                        onClick={() => trier(c.id)}
                        disabled={pending}
                        className="btn-fire inline-flex items-center gap-1 px-3 py-2 text-xs disabled:opacity-50"
                      >
                        <GitBranch size={13} /> Trier et lancer
                      </button>
                    )}
                    {["TRIEE", "EN_PRODUCTION", "PARTIELLE"].includes(c.statut) && (
                      <button onClick={() => changer(c.id, "LIVREE")} disabled={pending} className="btn-ghost px-3 py-2 text-xs disabled:opacity-50">
                        Marquer livrée
                      </button>
                    )}
                    {c.statut !== "ANNULEE" && c.statut !== "LIVREE" && (
                      <button onClick={() => changer(c.id, "ANNULEE")} disabled={pending} className="btn-ghost px-3 py-2 text-xs text-red-500 disabled:opacity-50">
                        Annuler
                      </button>
                    )}
                  </div>
                </div>

                {(c.lignes ?? []).length > 0 && (
                  <div className="mt-3 space-y-1 border-t border-black/5 pt-3">
                    {(c.lignes ?? []).map((l: any) => (
                      <div key={l.id} className="flex items-center justify-between text-xs">
                        <span className="truncate text-[#4b4f58]">{l.designation}</span>
                        <span className="ml-3 shrink-0 font-bold tabular-nums">
                          ×{Number(l.quantite)}
                          {Number(l.prix_unitaire) > 0 ? ` · ${(Number(l.quantite) * Number(l.prix_unitaire)).toLocaleString("fr-FR")} DA` : ""}
                        </span>
                      </div>
                    ))}
                    {c.note ? <p className="pt-1 text-xs italic text-[#7c8091]">{c.note}</p> : null}
                  </div>
                )}

                <p className="mt-2 text-[11px] text-[#9aa0ab]">
                  <Copy size={10} className="mr-1 inline" />
                  {baseUrl}/commande/{c.token}
                </p>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/30 p-4" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="card my-8 w-full max-w-3xl space-y-4 p-5">
            <h3 className="text-lg font-extrabold">Nouvelle commande client</h3>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <input className="input" placeholder="Nom du client *" value={client.nom} onChange={(e) => setClient({ ...client, nom: e.target.value })} />
              <input className="input" placeholder="Téléphone" value={client.telephone} onChange={(e) => setClient({ ...client, telephone: e.target.value })} />
              <input className="input" placeholder="E-mail" value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} />
              <input className="input" placeholder="Adresse" value={client.adresse} onChange={(e) => setClient({ ...client, adresse: e.target.value })} />
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Produits</p>
              {lignes.map((l, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <select className="input col-span-6" value={l.articleId ?? ""} onChange={(e) => choisirArticle(i, e.target.value)}>
                    <option value="">— Choisir un produit du catalogue —</option>
                    {catalogue.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.designation}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input col-span-2"
                    type="number"
                    min={1}
                    placeholder="Qté"
                    value={l.quantite}
                    onChange={(e) => setLignes((x) => x.map((y, j) => (j === i ? { ...y, quantite: Number(e.target.value) } : y)))}
                  />
                  <input
                    className="input col-span-3"
                    type="number"
                    min={0}
                    placeholder="Prix unitaire"
                    value={l.prixUnitaire}
                    onChange={(e) => setLignes((x) => x.map((y, j) => (j === i ? { ...y, prixUnitaire: Number(e.target.value) } : y)))}
                  />
                  <button
                    className="btn-ghost col-span-1 grid place-items-center text-red-500"
                    onClick={() => setLignes((x) => (x.length > 1 ? x.filter((_, j) => j !== i) : x))}
                    title="Retirer"
                  >
                    <Trash2 size={14} />
                  </button>
                  {l.articleId ? null : (
                    <input
                      className="input col-span-12"
                      placeholder="…ou décrivez le produit à la main (ex. Chaise CANADA rouge)"
                      value={l.designation}
                      onChange={(e) => setLignes((x) => x.map((y, j) => (j === i ? { ...y, designation: e.target.value } : y)))}
                    />
                  )}
                </div>
              ))}
              <button
                className="btn-ghost inline-flex items-center gap-1 px-3 py-2 text-xs"
                onClick={() => setLignes((x) => [...x, { articleId: null, designation: "", quantite: 1, prixUnitaire: 0 }])}
              >
                <Plus size={13} /> Ajouter une ligne
              </button>
            </div>

            <input className="input" placeholder="Note (délai, teinte, condition…)" value={client.note} onChange={(e) => setClient({ ...client, note: e.target.value })} />

            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">
                Total estimé : {totalLignes.toLocaleString("fr-FR")} DA
              </p>
              <div className="flex gap-2">
                <button onClick={() => setOpen(false)} className="btn-ghost px-4 py-2 text-sm">
                  Annuler
                </button>
                <button onClick={creer} disabled={pending || !client.nom.trim()} className="btn-fire px-4 py-2 text-sm disabled:opacity-50">
                  {pending ? "Enregistrement…" : "Enregistrer la commande"}
                </button>
              </div>
            </div>

            <p className="text-xs text-[#7c8091]">
              Après enregistrement, copiez le lien client : le client pourra compléter ou confirmer sa commande depuis son téléphone.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
