"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play, Flag, PackageMinus, CheckCircle2, Clock } from "lucide-react";
import { pointerJournee, declarerEtape, demarrerAffectation } from "@/app/actions-workflow";

type Etape = {
  affectationId: string | null;
  stepId: string;
  ordreDuJour: number | null;
  atelierId: number | null;
  atelierNom: string;
  nom: string;
  commande: string;
  produit: string;
  quantite: number;
  statut: string;
  estPremiere: boolean;
  estDerniere: boolean;
  minutesEstimees: number;
};

export default function JourneeClient({ token, etat }: { token: string; etat: any }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);

  if (!etat?.ok) {
    return (
      <Cadre>
        <p className="text-sm text-red-600">{etat?.message ?? "Code illisible."}</p>
        <p className="mt-2 text-xs text-[#7c8091]">
          Demandez à l'administrateur de régénérer les codes du jour : ils changent chaque matin.
        </p>
      </Cadre>
    );
  }

  const pointer = () =>
    start(async () => {
      const r = await pointerJournee({ token });
      setMessage({ ok: r.ok, texte: r.message });
      if (r.ok) router.refresh();
    });

  // ── QR entrée / sortie ──
  if (etat.type === "ENTREE") {
    const dejaPointe = !etat.prochainPointage;
    return (
      <Cadre>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#7c8091]">{etat.jour} · {etat.atelier ?? "ADMEDCO"}</p>
        <h1 className="text-2xl font-extrabold">{etat.ouvrier?.nom}</h1>

        {message && (
          <div className={`rounded-xl border p-3 text-sm ${message.ok ? "border-[#4a7c59]/30 bg-[#4a7c59]/5 text-[#2f5a3c]" : "border-red-200 bg-red-50 text-red-600"}`}>
            {message.texte}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="rounded-xl border border-black/5 bg-[#f8f7f5] p-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Entrée</p>
            <p className="text-lg font-black">{etat.arrivee ? heure(etat.arrivee) : "—"}</p>
          </div>
          <div className="rounded-xl border border-black/5 bg-[#f8f7f5] p-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">Sortie</p>
            <p className="text-lg font-black">{etat.depart ? heure(etat.depart) : "—"}</p>
          </div>
        </div>

        <button
          onClick={pointer}
          disabled={pending || dejaPointe}
          className="btn-fire w-full px-4 py-4 text-base disabled:opacity-50"
        >
          {pending
            ? "Enregistrement…"
            : dejaPointe
              ? "Journée déjà pointée"
              : etat.prochainPointage === "ARRIVEE"
                ? "Pointer mon ENTRÉE"
                : "Pointer ma SORTIE"}
        </button>

        <p className="text-center text-xs text-[#7c8091]">
          Ce code sert à contrôler l'entrée et la sortie. Pour voir votre travail du jour, scannez votre autre code.
        </p>
      </Cadre>
    );
  }

  // ── QR « ma journée » ──
  const etapes: Etape[] = etat.etapes ?? [];

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <header className="mb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#7c8091]">
          {etat.jour} · {etat.atelier ?? "ADMEDCO"} · {etapes.length} opération(s)
        </p>
        <h1 className="text-2xl font-extrabold tracking-tight">{etat.ouvrier?.nom}</h1>
        <p className="mt-1 text-sm text-[#7c8091]">
          Votre travail du jour, dans l'ordre donné par l'administrateur. Déclarez chaque étape : ce que vous avez pris, ce qui a réussi, ce qui est perdu.
        </p>
      </header>

      {message && (
        <div className={`card mb-4 flex items-start gap-2 p-4 text-sm ${message.ok ? "border-[#4a7c59]/30 bg-[#4a7c59]/5 text-[#2f5a3c]" : "border-red-200 bg-red-50 text-red-600"}`}>
          {message.ok && <CheckCircle2 size={16} className="mt-0.5 shrink-0" />}
          <span>{message.texte}</span>
        </div>
      )}

      {etapes.length === 0 ? (
        <div className="card p-6 text-center text-sm text-[#7c8091]">
          Aucune opération ne vous est encore affectée aujourd'hui.
        </div>
      ) : (
        <div className="space-y-3">
          {etapes.map((e, index) => (
            <EtapeCarte
              key={e.stepId}
              etape={e}
              rang={index + 1}
              onFait={(texte, ok) => {
                setMessage({ ok, texte });
                if (ok) router.refresh();
              }}
            />
          ))}
        </div>
      )}

      <footer className="mt-6 text-center text-xs text-[#9aa0ab]">
        Votre atelier et vos opérations changent chaque jour : ce code est régénéré chaque matin.
      </footer>
    </main>
  );
}

function EtapeCarte({
  etape,
  rang,
  onFait,
}: {
  etape: Etape;
  rang: number;
  onFait: (texte: string, ok: boolean) => void;
}) {
  const [pending, start] = useTransition();
  const [ouvert, setOuvert] = useState(false);
  const [pris, setPris] = useState(etape.quantite || 0);
  const [ok, setOk] = useState(etape.quantite || 0);
  const [rebut, setRebut] = useState(0);
  const [parquer, setParquer] = useState(false);
  const [motif, setMotif] = useState("");

  const demarrer = () =>
    start(async () => {
      if (!etape.affectationId) {
        onFait("Aucune affectation nominative sur cette étape : voyez l'administrateur.", false);
        return;
      }
      const r = await demarrerAffectation({ affectationId: etape.affectationId });
      onFait(r.message, r.ok);
      if (r.ok) setOuvert(true);
    });

  const declarer = () =>
    start(async () => {
      const r = await declarerEtape({
        stepId: etape.stepId,
        quantityTaken: pris,
        quantityOk: ok,
        quantityRebut: rebut,
        parquer,
        motif,
      });
      onFait(r.message, r.ok);
      if (r.ok) setOuvert(false);
    });

  const finie = etape.statut === "DONE";

  return (
    <section className={`card p-4 ${finie ? "opacity-70" : ""} ${etape.estPremiere || etape.estDerniere ? "border-[#c24a08]/30" : ""}`}>
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#f3f0eb] text-sm font-black">{rang}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-extrabold">{etape.nom}</p>
            {etape.estPremiere && <Badge texte="Première opération" />}
            {etape.estDerniere && <Badge texte="Dernière opération" />}
            {etape.statut === "ACTIVE" && <Badge texte="En cours" ton="bleu" />}
            {finie && <Badge texte="Terminée" ton="vert" />}
          </div>
          <p className="text-xs text-[#7c8091]">
            {etape.atelierNom} · commande {etape.commande} · {etape.produit}
          </p>
          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-[#7c8091]">
            <Clock size={11} /> {etape.minutesEstimees} min estimées
          </p>
        </div>
      </div>

      {!finie && (
        <div className="mt-3 flex flex-wrap gap-2">
          {!ouvert && (
            <>
              <button onClick={demarrer} disabled={pending} className="btn-ghost inline-flex items-center gap-1 px-3 py-2 text-xs disabled:opacity-50">
                <Play size={13} /> Démarrer
              </button>
              <button onClick={() => setOuvert(true)} className="btn-fire inline-flex items-center gap-1 px-3 py-2 text-xs">
                <Flag size={13} /> Déclarer
              </button>
            </>
          )}
        </div>
      )}

      {ouvert && !finie && (
        <div className="mt-3 space-y-3 rounded-xl border border-black/5 bg-[#f8f7f5] p-3">
          <div className="grid grid-cols-3 gap-2">
            <Champ label="Pris" value={pris} onChange={setPris} />
            <Champ label="Réussi" value={ok} onChange={setOk} />
            <Champ label="Perdu" value={rebut} onChange={setRebut} />
          </div>

          <label className="flex items-center gap-2 text-xs font-bold">
            <input type="checkbox" checked={parquer} onChange={(e) => setParquer(e.target.checked)} />
            <PackageMinus size={13} /> Laisser cette commande en attente (urgence prioritaire)
          </label>

          {parquer && (
            <input className="input" placeholder="Motif — quelle commande passe devant ?" value={motif} onChange={(e) => setMotif(e.target.value)} />
          )}

          <div className="flex justify-end gap-2">
            <button onClick={() => setOuvert(false)} className="btn-ghost px-3 py-2 text-xs">
              Annuler
            </button>
            <button onClick={declarer} disabled={pending} className="btn-fire px-3 py-2 text-xs disabled:opacity-50">
              {pending ? "Enregistrement…" : parquer ? "Enregistrer et parquer" : "Valider l'étape"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Champ({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold uppercase tracking-widest text-[#7c8091]">{label}</span>
      <input className="input mt-1" type="number" min={0} value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} />
    </label>
  );
}

function Badge({ texte, ton }: { texte: string; ton?: "bleu" | "vert" }) {
  const cls =
    ton === "bleu"
      ? "border-[#2f6eb5]/25 bg-[#2f6eb5]/10 text-[#2f6eb5]"
      : ton === "vert"
        ? "border-[#4a7c59]/25 bg-[#4a7c59]/10 text-[#4a7c59]"
        : "border-[#c24a08]/25 bg-[#c24a08]/10 text-[#c24a08]";
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${cls}`}>{texte}</span>;
}

function Cadre({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <div className="card space-y-2 p-6">{children}</div>
    </main>
  );
}

function heure(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}
