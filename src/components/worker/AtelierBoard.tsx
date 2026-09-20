"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Play, CheckCircle2, Archive, ChevronDown, Lock, Loader2, AlertTriangle,
  Clock, User2, Package, ArrowRight, Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { commencerTache, terminerTache, parquerTache, lacherTache, type Tache } from "@/app/actions-atelier";
import { ficheAtelier } from "@/lib/portail-atelier";

type Props = {
  taches: Tache[];
  atelierId: number;
  accent: string;
  /** Nombre de postes de l'atelier, pour l'en-tête. */
  nbPostes: number;
};

type Vue = "afaire" | "bloquees";

export default function AtelierBoard({ taches, atelierId, accent, nbPostes }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ton: "ok" | "ko"; texte: string } | null>(null);
  const [vue, setVue] = useState<Vue>("afaire");

  // ── La synchronisation entre les postes ──
  //
  // La file de cet atelier dépend de QUATRE autres écrans : la pièce
  // que l'Atelier 1 vient de souder débloque le poudrage ici ; celle
  // que le poudrage libère débloque le bureau. Un écran figé affiche
  // donc une file qui n'existe plus, et l'ouvrier cherche une pièce
  // qui est déjà devant lui.
  //
  // Trois déclencheurs, du moins cher au plus cher :
  //
  //   1. après un geste      → `router.refresh()` dans `jouer()` ;
  //   2. retour sur l'onglet → un ouvrier qui reprend sa tablette ;
  //   3. un battement de 30 s, tant que l'onglet est VISIBLE.
  //
  // Le battement s'arrête tout seul quand l'écran est éteint ou que
  // l'onglet passe en arrière-plan : une tablette posée ne consomme
  // rien. Trente secondes, c'est le temps qu'un cariste met à
  // traverser l'atelier — plus court ne se verrait pas, plus long
  // ferait douter de l'écran.
  useEffect(() => {
    const auReveil = () => {
      if (document.visibilityState === "visible") router.refresh();
    };

    document.addEventListener("visibilitychange", auReveil);
    window.addEventListener("focus", auReveil);
    const battement = window.setInterval(auReveil, 30_000);

    return () => {
      document.removeEventListener("visibilitychange", auReveil);
      window.removeEventListener("focus", auReveil);
      window.clearInterval(battement);
    };
  }, [router]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 6000);
    return () => clearTimeout(t);
  }, [message]);

  const { miennes, aFaire, bloquees } = useMemo(() => {
    const miennes: Tache[] = [];
    const aFaire: Tache[] = [];
    const bloquees: Tache[] = [];
    for (const t of taches) {
      if (t.aMoi && t.statut === "ACTIVE") miennes.push(t);
      else if (t.bloquee) bloquees.push(t);
      else aFaire.push(t);
    }
    return { miennes, aFaire, bloquees };
  }, [taches]);

  const jouer = (fn: () => Promise<{ ok: boolean; message: string }>, fermer?: boolean) => {
    start(async () => {
      const r = await fn();
      setMessage({ ton: r.ok ? "ok" : "ko", texte: r.message });
      if (r.ok && fermer) setOuverte(null);
      router.refresh();
    });
  };

  const liste = vue === "afaire" ? aFaire : bloquees;

  return (
    <div className="space-y-5">
      {/* ══ Bandeau de résultats ══ */}
      {message && (
        <div
          className={cn(
            "sticky top-[76px] z-20 flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-[13px] font-semibold shadow-sm",
            message.ton === "ok"
              ? "border-[#4a7c59]/25 bg-[#4a7c59]/[0.07] text-[#3a6247]"
              : "border-red-200 bg-red-50 text-red-700",
          )}
        >
          {message.ton === "ok" ? (
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          )}
          <span className="flex-1">{message.texte}</span>
          <button onClick={() => setMessage(null)} className="shrink-0 text-[11px] font-black opacity-50 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {/* ══ Compteurs ══ */}
      <div className="grid grid-cols-3 gap-3">
        <Compteur valeur={aFaire.length} libelle="À faire" accent={accent} />
        <Compteur valeur={miennes.length} libelle="En cours" accent="#c24a08" />
        <Compteur valeur={bloquees.length} libelle="En attente d'amont" accent="#9ca3af" />
      </div>

      {/* ══ Ma tâche en cours ══
          Elle reste en haut quoi qu'il arrive : c'est ce que l'ouvrier
          a dans les mains. La lui cacher serait le seul vrai défaut de
          cet écran. */}
      {miennes.map((t) => (
        <CarteTache
          key={t.stepId}
          tache={t}
          accent={accent}
          ouverte={ouverte === t.stepId}
          onBasculer={() => setOuverte(ouverte === t.stepId ? null : t.stepId)}
          enCours={pending}
          onCommencer={() => jouer(() => commencerTache({ stepId: t.stepId }))}
          onTerminer={(pris, ok, rebut) =>
            jouer(() => terminerTache({ stepId: t.stepId, pris, ok, rebut }), true)
          }
          onParquer={(pris, ok, rebut, motif) =>
            jouer(() => parquerTache({ stepId: t.stepId, pris, ok, rebut, motif }), true)
          }
          onLacher={() => jouer(() => lacherTache({ stepId: t.stepId }))}
          epinglee
        />
      ))}

      {/* ══ La file ══ */}
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex gap-1 rounded-xl border border-black/[0.06] bg-white p-1 shadow-sm">
            <Onglet actif={vue === "afaire"} onClick={() => setVue("afaire")} accent={accent}>
              À faire · {aFaire.length}
            </Onglet>
            <Onglet actif={vue === "bloquees"} onClick={() => setVue("bloquees")} accent={accent}>
              Bloquées · {bloquees.length}
            </Onglet>
          </div>
          <p className="hidden text-[11px] font-bold uppercase tracking-[0.18em] text-[#b0b5bf] sm:block">
            {nbPostes} postes · {ficheAtelier(atelierId)?.code}
          </p>
        </div>

        {liste.length === 0 ? (
          <Vide vue={vue} accent={accent} />
        ) : (
          <div className="space-y-2.5">
            {liste.map((t) => (
              <CarteTache
                key={t.stepId}
                tache={t}
                accent={accent}
                ouverte={ouverte === t.stepId}
                onBasculer={() => setOuverte(ouverte === t.stepId ? null : t.stepId)}
                enCours={pending}
                onCommencer={() => jouer(() => commencerTache({ stepId: t.stepId }))}
                onTerminer={(pris, ok, rebut) =>
                  jouer(() => terminerTache({ stepId: t.stepId, pris, ok, rebut }), true)
                }
                onParquer={(pris, ok, rebut, motif) =>
                  jouer(() => parquerTache({ stepId: t.stepId, pris, ok, rebut, motif }), true)
                }
                onLacher={() => jouer(() => lacherTache({ stepId: t.stepId }))}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// LA CARTE D'UNE TÂCHE
// ═══════════════════════════════════════════════════════════

function CarteTache({
  tache, accent, ouverte, onBasculer, enCours, onCommencer, onTerminer, onParquer, onLacher, epinglee,
}: {
  tache: Tache;
  accent: string;
  ouverte: boolean;
  onBasculer: () => void;
  enCours: boolean;
  onCommencer: () => void;
  onTerminer: (pris: number, ok: number, rebut: number) => void;
  onParquer: (pris: number, ok: number, rebut: number, motif: string) => void;
  onLacher: () => void;
  epinglee?: boolean;
}) {
  const active = tache.statut === "ACTIVE";
  const demarree = Boolean(tache.commenceA);
  const cible = String(tache.cible || tache.quantiteCommande || 0);
  const [pris, setPris] = useState(cible);
  const [ok, setOk] = useState(cible);
  const [rebut, setRebut] = useState("0");
  const [motif, setMotif] = useState("");
  const [touche, setTouche] = useState(false);

  // ── La cible peut changer sous les doigts de l'ouvrier ──
  // L'admin ajuste parfois la quantité d'une commande pendant que le
  // poste est ouvert. Si l'ouvrier n'a encore rien saisi, on réaligne
  // les champs ; s'il a déjà tapé ses chiffres, on n'y touche pas —
  // écraser une saisie en cours serait le pire des deux maux.
  useEffect(() => {
    if (touche) return;
    setPris(cible);
    setOk(cible);
  }, [cible, touche]);

  const nPris = Number(pris) || 0;
  const nOk = Number(ok) || 0;
  const nRebut = Number(rebut) || 0;
  const ecart = Math.round((nPris - nOk - nRebut) * 100) / 100;
  const coherent = nPris > 0 && nOk >= 0 && nRebut >= 0 && Math.abs(ecart) < 0.0001;

  const suivant = ficheAtelier(tache.atelierSuivant);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow",
        active ? "shadow-md" : "",
        tache.bloquee ? "opacity-[0.72]" : "",
      )}
      style={active || epinglee ? { borderColor: `${accent}55`, boxShadow: `inset 3px 0 0 ${accent}` } : undefined}
    >
      {/* ── En-tête de la carte ── */}
      <button onClick={onBasculer} className="flex w-full items-start gap-3 px-4 py-3.5 text-left">
        {/* Le numéro de poste : c'est le repère que l'ouvrier cherche. */}
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[15px] font-black"
          style={{ background: `${accent}12`, color: accent }}
        >
          {tache.ordre || "—"}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[15px] font-extrabold tracking-tight text-[#1a1d23]">{tache.poste}</span>
            {active && (
              <span className="rounded-full bg-[#c24a08]/12 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#c24a08]">
                En cours
              </span>
            )}
            {tache.bloquee && (
              <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.05] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#9ca3af]">
                <Lock size={9} /> Amont
              </span>
            )}
          </span>

          <span className="mt-1 block truncate text-[13px] font-semibold text-[#6b7280]">{tache.produit}</span>

          <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#9ca3af]">
            <span className="inline-flex items-center gap-1 font-bold text-[#6b7280]">
              <Package size={11} /> {tache.cible || tache.quantiteCommande} pièce(s)
            </span>
            <span className="font-mono">{tache.orderNumber}</span>
            {tache.clientNom && <span className="truncate">👤 {tache.clientNom}</span>}
            {tache.minutesEstimees ? (
              <span className="inline-flex items-center gap-1">
                <Clock size={11} /> {tache.minutesEstimees} min
              </span>
            ) : null}
            {tache.ouvrier && (
              <span className="inline-flex items-center gap-1">
                <User2 size={11} /> {tache.ouvrier}
              </span>
            )}
          </span>
        </span>

        <ChevronDown
          size={18}
          className={cn("mt-1 shrink-0 text-[#b0b5bf] transition-transform", ouverte && "rotate-180")}
        />
      </button>

      {/* ── Barre d'avancement du parcours ── */}
      {tache.avancement.total > 0 && (
        <div className="flex items-center gap-2 px-4 pb-3">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.round((tache.avancement.faites / tache.avancement.total) * 100)}%`,
                background: accent,
              }}
            />
          </div>
          <span className="text-[10px] font-bold text-[#b0b5bf]">
            {tache.avancement.faites}/{tache.avancement.total} étapes
          </span>
          {suivant && tache.statut !== "PENDING" && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#b0b5bf]">
              <ArrowRight size={10} /> {suivant.code}
            </span>
          )}
        </div>
      )}

      {/* ── Ce qui bloque ── */}
      {tache.bloquee && (
        <div className="mx-4 mb-3 rounded-xl bg-black/[0.025] px-3 py-2 text-[11.5px] leading-relaxed text-[#7c8091]">
          En attente de <b>{tache.bloquePar ?? "l'étape précédente"}</b> sur ce même produit. Vous pouvez
          préparer, mais ne déclarez rien avant que la pièce arrive.
        </div>
      )}

      {/* ══ Le panneau de travail ══ */}
      {ouverte && (
        <div className="border-t border-black/[0.05] bg-black/[0.012] px-4 py-4">
          {!demarree ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[12.5px] leading-relaxed text-[#7c8091]">
                Prenez l'étape quand vous êtes <b>devant le poste</b> : l'horloge démarre au clic et
                s'arrêtera à votre déclaration.
              </p>
              <button
                onClick={onCommencer}
                disabled={enCours}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14px] font-black text-white shadow-sm transition-transform active:scale-[0.98] disabled:opacity-50"
                style={{ background: accent }}
              >
                {enCours ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                Commencer
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Les trois chiffres : PRIS / RÉUSSI / PERDU */}
              <div className="grid grid-cols-3 gap-2.5">
                <ChampQuantite
                  label="Pris"
                  aide="pièces sorties du stock"
                  valeur={pris}
                  onChange={(v) => { setTouche(true); setPris(v); }}
                  accent={accent}
                />
                <ChampQuantite
                  label="Réussi"
                  aide="bonnes pièces"
                  valeur={ok}
                  onChange={(v) => { setTouche(true); setOk(v); }}
                  accent="#4a7c59"
                />
                <ChampQuantite
                  label="Perdu"
                  aide="rebut"
                  valeur={rebut}
                  onChange={(v) => { setTouche(true); setRebut(v); }}
                  accent="#c24a08"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                {ecart > 0.0001 && (
                  <span className="rounded-xl bg-amber-50 px-3 py-1.5 font-bold text-amber-700">
                    Il reste {ecart} pièce(s) à justifier.
                  </span>
                )}
                {ecart < -0.0001 && (
                  <span className="rounded-xl bg-red-50 px-3 py-1.5 font-bold text-red-600">
                    Réussi + perdu dépasse le pris de {Math.abs(ecart)}.
                  </span>
                )}
                {coherent && (
                  <span className="rounded-xl bg-[#4a7c59]/10 px-3 py-1.5 font-bold text-[#4a7c59]">
                    Déclaration cohérente.
                  </span>
                )}
              </div>

              {/* Parquer */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#9ca3af]">
                  Mettre de côté (optionnel)
                </label>
                <input
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                  placeholder="Ex. pièce à reprendre, commande urgente passée devant…"
                  className="mt-1.5 w-full rounded-xl border border-black/[0.08] bg-white px-3.5 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-black/[0.06]"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => onTerminer(nPris, nOk, nRebut)}
                  disabled={enCours || !coherent}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-[14px] font-black text-white shadow-sm transition-transform active:scale-[0.98] disabled:opacity-40"
                  style={{ background: "#4a7c59" }}
                >
                  {enCours ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={17} />}
                  Terminer et passer à la suite
                </button>
                <button
                  onClick={() => onParquer(nPris, nOk, nRebut, motif)}
                  disabled={enCours || motif.trim().length < 3}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-black/[0.08] bg-white px-4 py-3.5 text-[13px] font-bold text-[#6b7280] transition-colors hover:text-[#1a1d23] disabled:opacity-40"
                  title={motif.trim().length < 3 ? "Indiquez d'abord le motif de mise de côté" : "Parquer la pièce"}
                >
                  <Archive size={16} /> Parquer
                </button>
                <button
                  onClick={onLacher}
                  disabled={enCours}
                  className="inline-flex items-center justify-center rounded-xl border border-black/[0.06] bg-white px-4 py-3.5 text-[12px] font-bold text-[#b0b5bf] transition-colors hover:text-[#c24a08] disabled:opacity-40"
                  title="Je n'ai rien déclaré : rendre l'étape à l'atelier"
                >
                  Relâcher
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PIÈCES D'INTERFACE
// ═══════════════════════════════════════════════════════════

function ChampQuantite({
  label, aide, valeur, onChange, accent,
}: {
  label: string;
  aide: string;
  valeur: string;
  onChange: (v: string) => void;
  accent: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: accent }}>
        {label}
      </span>
      {/* `inputMode="decimal"` : le pavé numérique s'ouvre directement,
          ce qui compte sur une tablette d'atelier. */}
      <input
        type="text"
        inputMode="decimal"
        value={valeur}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, "").replace(",", "."))}
        className="mt-1 w-full rounded-xl border-2 bg-white px-3 py-3 text-center text-[20px] font-black tabular-nums outline-none transition-colors focus:ring-2"
        style={{ borderColor: `${accent}33` }}
      />
      <span className="mt-0.5 block text-center text-[10px] text-[#b0b5bf]">{aide}</span>
    </label>
  );
}

function Compteur({ valeur, libelle, accent }: { valeur: number; libelle: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-black/[0.05] bg-white px-3 py-3 text-center shadow-sm">
      <p className="text-[24px] font-black leading-none tabular-nums" style={{ color: valeur > 0 ? accent : "#d6d9de" }}>
        {valeur}
      </p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#9ca3af]">{libelle}</p>
    </div>
  );
}

function Onglet({
  actif, onClick, accent, children,
}: {
  actif: boolean;
  onClick: () => void;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn("rounded-lg px-3.5 py-2 text-[12px] font-bold transition-colors")}
      style={actif ? { background: `${accent}14`, color: accent } : { color: "#9ca3af" }}
    >
      {children}
    </button>
  );
}

function Vide({ vue, accent }: { vue: Vue; accent: string }) {
  const contenu =
    vue === "afaire"
      ? {
          icone: <CheckCircle2 size={30} style={{ color: accent }} />,
          titre: "Rien en attente sur votre poste",
          texte:
            "Toutes les pièces de votre atelier sont déclarées. La liste se remplira dès qu'un poste en amont aura terminé.",
        }
      : {
          icone: <Layers size={30} className="text-[#c9cdd4]" />,
          titre: "Rien n'est bloqué en amont",
          texte: "Aucune pièce n'attend une étape précédente. Vous pouvez enchaîner.",
        };
  return (
    <div className="rounded-2xl border border-dashed border-black/[0.1] bg-white px-5 py-10 text-center">
      <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-black/[0.03]">{contenu.icone}</div>
      <p className="text-[15px] font-extrabold tracking-tight text-[#1a1d23]">{contenu.titre}</p>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-[#9ca3af]">{contenu.texte}</p>
    </div>
  );
}
