"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Printer, RefreshCw, UserCheck, Trophy, Activity, QrCode } from "lucide-react";
import { GlassCard, SectionTitle, Stat, StatusPill, Empty } from "@/components/admin/ui";
import { genererJournees, affecterEtape } from "@/app/actions-workflow";

type Ouvrier = { id: string; nom: string; atelierId: number | null; usine: string };
type Atelier = { id: number; code: string; nom: string; site: string };
type Journee = {
  id: string;
  workerId: string;
  nom: string;
  atelierId: number | null;
  qrJournee: string;
  qrEntree: string;
  arrivee: string | null;
  depart: string | null;
};
type Etape = {
  id: string;
  atelierId: number;
  nom: string;
  ordre: number;
  sequence: number;
  statut: string;
  quantite: number;
  produit: string;
  commande: string;
  minutes: number;
};

export default function PageClient({
  jour,
  baseUrl,
  ouvriers,
  ateliers,
  journees,
  etapes,
  bilan,
  classement,
  classementMessage,
  erreur,
}: {
  jour: string;
  baseUrl: string;
  ouvriers: Ouvrier[];
  ateliers: Atelier[];
  journees: Journee[];
  etapes: Etape[];
  bilan: any[];
  classement: any[];
  classementMessage: string | null;
  erreur: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [onglet, setOnglet] = useState<"codes" | "affectation" | "pilotage">("codes");
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [atelierGen, setAtelierGen] = useState<string>("");
  const [qr, setQr] = useState<Record<string, { journee: string; entree: string }>>({});

  const [filtreAtelier, setFiltreAtelier] = useState<string>("");
  const [choix, setChoix] = useState<Record<string, { workerId: string; ordre: string; minutes: string }>>({});

  // Les QR sont des images : on les fabrique côté navigateur, une
  // seule fois par jeu de jetons. `qrcode` accepte l'adresse
  // complète — c'est le téléphone de l'ouvrier qui l'ouvrira.
  useEffect(() => {
    let annule = false;
    (async () => {
      const out: Record<string, { journee: string; entree: string }> = {};
      for (const j of journees) {
        out[j.workerId] = {
          journee: await QRCode.toDataURL(`${baseUrl}/journee/${j.qrJournee}`, { width: 200, margin: 1 }),
          entree: await QRCode.toDataURL(`${baseUrl}/journee/${j.qrEntree}`, { width: 200, margin: 1 }),
        };
      }
      if (!annule) setQr(out);
    })();
    return () => {
      annule = true;
    };
  }, [journees, baseUrl]);

  const generer = () => {
    setMessage(null);
    start(async () => {
      const r = await genererJournees({
        jour,
        atelierId: atelierGen ? Number(atelierGen) : null,
      });
      setMessage({ ok: r.ok, texte: r.message });
      if (r.ok) router.refresh();
    });
  };

  const affecter = (stepId: string) => {
    const c = choix[stepId];
    if (!c?.workerId) {
      setMessage({ ok: false, texte: "Choisissez d'abord l'ouvrier à qui confier cette opération." });
      return;
    }
    setMessage(null);
    start(async () => {
      const r = await affecterEtape({
        stepId,
        workerId: c.workerId,
        jour,
        ordreDuJour: c.ordre ? Number(c.ordre) : null,
        minutesEstimees: c.minutes ? Number(c.minutes) : null,
      });
      setMessage({ ok: r.ok, texte: r.message });
      if (r.ok) router.refresh();
    });
  };

  const etapesFiltrees = useMemo(
    () => (filtreAtelier ? etapes.filter((e) => String(e.atelierId) === filtreAtelier) : etapes),
    [etapes, filtreAtelier],
  );

  const atelierNom = (id: number | null) => ateliers.find((a) => a.id === id)?.nom ?? "—";

  const totaux = useMemo(() => {
    const qtyOk = bilan.reduce((n, l) => n + (Number(l.qtyOk) || 0), 0);
    const qtyRebut = bilan.reduce((n, l) => n + (Number(l.qtyRebut) || 0), 0);
    const heures = bilan.reduce((n, l) => n + (Number(l.heuresTravail) || 0), 0);
    return { qtyOk, qtyRebut, heures: Math.round(heures * 100) / 100 };
  }, [bilan]);

  return (
    <div className="stagger space-y-5">
      {erreur && (
        <div className="card border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 print:hidden">
          {erreur}
        </div>
      )}

      <div className="print:hidden">
        <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Journée</span>
            <input
              type="date"
              className="input mt-1"
              value={jour}
              onChange={(e) => router.push(`/admin/ouvriers?jour=${e.target.value}`)}
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Atelier</span>
            <select className="input mt-1" value={atelierGen} onChange={(e) => setAtelierGen(e.target.value)}>
              <option value="">Tous les ateliers</option>
              {ateliers.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nom}
                </option>
              ))}
            </select>
          </label>
          <button onClick={generer} disabled={pending} className="btn-fire inline-flex items-center gap-1 px-4 py-2 text-sm disabled:opacity-50">
            <RefreshCw size={14} className={pending ? "animate-spin" : ""} /> Générer les codes du matin
          </button>
          {journees.length > 0 && (
            <button onClick={() => window.print()} className="btn-ghost inline-flex items-center gap-1 px-4 py-2 text-sm">
              <Printer size={14} /> Imprimer la feuille de codes
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Ouvriers" value={String(ouvriers.length)} sub="Rôle WORKER" />
          <Stat label="Codes générés" value={String(journees.length)} accent="ice" sub={`Journée du ${jour}`} />
          <Stat label="Réussi aujourd'hui" value={String(totaux.qtyOk)} accent="green" />
          <Stat label="Perdu aujourd'hui" value={String(totaux.qtyRebut)} accent={totaux.qtyRebut > 0 ? "red" : undefined} />
        </div>
      </div>

      {message && (
        <div className={`card p-4 text-sm print:hidden ${message.ok ? "border-[#4a7c59]/30 bg-[#4a7c59]/5 text-[#2f5a3c]" : "border-red-200 bg-red-50 text-red-600"}`}>
          {message.texte}
        </div>
      )}

      <div className="flex gap-2 print:hidden">
        {(
          [
            ["codes", "Codes du jour", QrCode],
            ["affectation", "Affectation", UserCheck],
            ["pilotage", "Bilan & classement", Trophy],
          ] as const
        ).map(([cle, label, Icone]) => (
          <button
            key={cle}
            onClick={() => setOnglet(cle)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition ${
              onglet === cle ? "bg-[#1a1d23] text-white" : "bg-[#f3f0eb] text-[#4b4f58] hover:bg-[#e9e4dc]"
            }`}
          >
            <Icone size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ═══════════ CODES DU JOUR ═══════════ */}
      {onglet === "codes" && (
        <GlassCard className="print:shadow-none">
          <div className="print:hidden">
            <SectionTitle
              kicker="Contrôle"
              title={`Feuille de codes — ${jour}`}
              hint="Deux codes par ouvrier : « ma journée » (à gauche) et « entrée / sortie » (à droite). Ils changent chaque matin."
            />
          </div>
          {journees.length === 0 ? (
            <Empty
              icon="🔲"
              title="Aucun code pour ce jour"
              hint="Touchez « Générer les codes du matin ». Les ouvriers doivent exister avec le rôle WORKER et leur atelier."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 print:grid-cols-2">
              {journees.map((j) => (
                <div key={j.id} className="rounded-2xl border border-black/10 bg-white p-4 text-black break-inside-avoid">
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <p className="font-extrabold">{j.nom}</p>
                      <p className="text-[11px] text-[#7c8091]">{atelierNom(j.atelierId)} · {jour}</p>
                    </div>
                    <div className="text-right text-[11px] text-[#7c8091]">
                      <p>Entrée : {j.arrivee ? j.arrivee.slice(11, 16) : "—"}</p>
                      <p>Sortie : {j.depart ? j.depart.slice(11, 16) : "—"}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <figure className="text-center">
                      {qr[j.workerId]?.journee ? <img src={qr[j.workerId].journee} alt="" className="mx-auto h-[150px] w-[150px]" /> : <div className="h-[150px]" />}
                      <figcaption className="mt-1 text-[11px] font-bold">
                        MA JOURNÉE
                        <span className="block font-normal text-[#7c8091]">Tout son travail du jour</span>
                      </figcaption>
                    </figure>
                    <figure className="text-center">
                      {qr[j.workerId]?.entree ? <img src={qr[j.workerId].entree} alt="" className="mx-auto h-[150px] w-[150px]" /> : <div className="h-[150px]" />}
                      <figcaption className="mt-1 text-[11px] font-bold">
                        ENTRÉE / SORTIE
                        <span className="block font-normal text-[#7c8091]">Première et dernière opération</span>
                      </figcaption>
                    </figure>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      )}

      {/* ═══════════ AFFECTATION ═══════════ */}
      {onglet === "affectation" && (
        <GlassCard>
          <SectionTitle
            kicker="Qui passe en premier, qui passe en dernier"
            title="Opérations à affecter"
            hint="Les ouvriers sont polyvalents et changent de poste : l'affectation vaut pour la journée, pas pour la vie."
            right={
              <select className="input w-56" value={filtreAtelier} onChange={(e) => setFiltreAtelier(e.target.value)}>
                <option value="">Tous les ateliers</option>
                {ateliers.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nom}
                  </option>
                ))}
              </select>
            }
          />
          {etapesFiltrees.length === 0 ? (
            <Empty icon="📋" title="Aucune opération en attente" hint="Lancez une production depuis Commandes client ou Depuis les ateliers." />
          ) : (
            <div className="space-y-2">
              {etapesFiltrees.map((e) => {
                const c = choix[e.id] ?? { workerId: "", ordre: "", minutes: "" };
                const ouvriersAtelier = e.atelierId
                  ? ouvriers.filter((o) => o.atelierId === e.atelierId)
                  : ouvriers;
                const liste = ouvriersAtelier.length > 0 ? ouvriersAtelier : ouvriers;
                return (
                  <div key={e.id} className="card flex flex-wrap items-end gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill status={e.statut} />
                        <span className="font-bold">{e.nom}</span>
                        <span className="text-xs text-[#7c8091]">étape {e.ordre} · {atelierNom(e.atelierId)}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-[#7c8091]">
                        {e.commande} · {e.produit} · {e.quantite} pièce(s) · {e.minutes} min estimées
                      </p>
                    </div>
                    <select
                      className="input w-52"
                      value={c.workerId}
                      onChange={(ev) => setChoix((x) => ({ ...x, [e.id]: { ...c, workerId: ev.target.value } }))}
                    >
                      <option value="">— Ouvrier —</option>
                      {liste.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.nom}
                        </option>
                      ))}
                    </select>
                    <input
                      className="input w-24"
                      type="number"
                      min={1}
                      placeholder="N° ordre"
                      value={c.ordre}
                      onChange={(ev) => setChoix((x) => ({ ...x, [e.id]: { ...c, ordre: ev.target.value } }))}
                    />
                    <input
                      className="input w-24"
                      type="number"
                      min={1}
                      placeholder={`${e.minutes} min`}
                      title="Temps estimé — référence du classement"
                      value={c.minutes}
                      onChange={(ev) => setChoix((x) => ({ ...x, [e.id]: { ...c, minutes: ev.target.value } }))}
                    />
                    <button onClick={() => affecter(e.id)} disabled={pending} className="btn-fire px-3 py-2 text-xs disabled:opacity-50">
                      Affecter
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      )}

      {/* ═══════════ BILAN & CLASSEMENT ═══════════ */}
      {onglet === "pilotage" && (
        <>
          <GlassCard>
            <SectionTitle
              kicker="Automatique"
              title={`Bilan du ${jour}`}
              hint="Calculé à partir des déclarations de chaque ouvrier — aucune saisie supplémentaire."
              right={
                <span className="inline-flex items-center gap-1 text-xs text-[#7c8091]">
                  <Activity size={13} /> {totaux.heures} h de travail
                </span>
              }
            />
            {bilan.length === 0 ? (
              <Empty icon="📊" title="Aucune activité ce jour" hint="Le bilan apparaît dès la première étape déclarée." />
            ) : (
              <div className="space-y-1.5">
                {bilan.map((l, i) => (
                  <div key={i} className="card flex flex-wrap items-center justify-between gap-3 p-3">
                    <div>
                      <p className="text-sm font-bold">{l.atelierNom ?? "Atelier non précisé"}</p>
                      <p className="text-xs text-[#7c8091]">
                        {l.nbOuvriers} ouvrier(s) · {l.heuresTravail} h
                      </p>
                    </div>
                    <div className="flex gap-4 text-right text-xs">
                      <span>
                        <strong className="block text-base tabular-nums">{l.qtyPrise}</strong>
                        <span className="text-[#7c8091]">pris</span>
                      </span>
                      <span>
                        <strong className="block text-base tabular-nums text-[#4a7c59]">{l.qtyOk}</strong>
                        <span className="text-[#7c8091]">réussi</span>
                      </span>
                      <span>
                        <strong className="block text-base tabular-nums text-red-500">{l.qtyRebut}</strong>
                        <span className="text-[#7c8091]">perdu</span>
                      </span>
                      <span>
                        <strong className="block text-base tabular-nums">{l.tauxReussite === null ? "—" : `${l.tauxReussite} %`}</strong>
                        <span className="text-[#7c8091]">réussite</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          <GlassCard>
            <SectionTitle
              kicker="Vous seul"
              title="Classement des ouvriers"
              hint="Croise le volume produit, le taux de réussite et l'écart au temps estimé. Un ouvrier qui casse beaucoup ne remonte pas."
            />
            {classementMessage ? (
              <Empty icon="🔒" title="Classement indisponible" hint={classementMessage} />
            ) : classement.length === 0 ? (
              <Empty icon="🏁" title="Pas encore de classement" hint="Il se construit à partir des étapes terminées et chronométrées." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-widest text-[#7c8091]">
                      <th className="py-2">#</th>
                      <th className="py-2">Ouvrier</th>
                      <th className="py-2">Atelier</th>
                      <th className="py-2 text-right">Étapes</th>
                      <th className="py-2 text-right">Réussi</th>
                      <th className="py-2 text-right">Perdu</th>
                      <th className="py-2 text-right">Réussite</th>
                      <th className="py-2 text-right">Temps</th>
                      <th className="py-2 text-right">Écart</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classement.map((l, i) => (
                      <tr key={`${l.workerId}-${l.atelierId}-${i}`} className="border-t border-black/5">
                        <td className="py-2 font-black text-[#c24a08]">{i + 1}</td>
                        <td className="py-2 font-bold">{l.nom}</td>
                        <td className="py-2 text-xs text-[#7c8091]">{l.atelierCode ?? "—"}</td>
                        <td className="py-2 text-right tabular-nums">{l.etapesTerminees}</td>
                        <td className="py-2 text-right tabular-nums text-[#4a7c59]">{l.qtyOk}</td>
                        <td className="py-2 text-right tabular-nums text-red-500">{l.qtyRebut}</td>
                        <td className="py-2 text-right tabular-nums">{l.tauxReussite === null ? "—" : `${l.tauxReussite} %`}</td>
                        <td className="py-2 text-right tabular-nums text-xs">
                          {Math.round(l.minutesTravail)} min
                          <span className="block text-[#9aa0ab]">est. {Math.round(l.minutesEstimees)}</span>
                        </td>
                        <td className={`py-2 text-right tabular-nums text-xs ${l.ecartTemps === null ? "" : l.ecartTemps > 0 ? "text-red-500" : "text-[#4a7c59]"}`}>
                          {l.ecartTemps === null ? "—" : `${l.ecartTemps > 0 ? "+" : ""}${l.ecartTemps} min`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </>
      )}
    </div>
  );
}
