"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, RotateCw, LayoutGrid, QrCode, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  FICHES_ATELIERS,
  fichesParUsine,
  urlAtelier,
  USINES_AFFICHEES,
  type FicheAtelier,
} from "@/lib/portail-atelier";

type Props = {
  fiche: FicheAtelier | null;
  /** Nom affiché de l'ouvrier. */
  nom: string;
  /** Vrai pour un ADMIN : il visite l'atelier sans y être affecté. */
  visiteur?: boolean;
  /** Nombre de tâches en attente, pour la pastille. */
  enAttente?: number;
  /** Ce que l'atelier fait, en une ligne, sous le titre. */
  sousTitre?: string;
  children: ReactNode;
};

/**
 * L'ossature des portails d'atelier.
 *
 * Volontairement plus sobre que `AdminShell` : un ouvrier consulte son
 * poste debout, sur une tablette, souvent avec des gants. Trois choses
 * seulement comptent à l'écran — quel atelier, qui je suis, et ce que
 * j'ai à faire. Pas de menu de pilotage, pas de graphiques.
 *
 * La navigation est celle des ATELIERS, groupée par usine : passer
 * d'ADMEDCO à MOBILIX se voit tout de suite, et la couleur du bandeau
 * change avec l'atelier — l'ouvrier sait en un regard s'il est sur son
 * poste ou sur celui d'à côté.
 */
export default function AtelierShell({ fiche, nom, visiteur, enAttente = 0, sousTitre, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [navOuverte, setNavOuverte] = useState(false);
  const [synchro, setSynchro] = useState(false);
  const [enLigne, setEnLigne] = useState(true);

  const accent = fiche?.accent ?? "#4a7c59";

  useEffect(() => { setNavOuverte(false); }, [pathname]);

  // L'état réseau conditionne ce que l'ouvrier peut faire : on l'affiche
  // plutôt que de le laisser découvrir une action qui échoue.
  useEffect(() => {
    const maj = () => setEnLigne(navigator.onLine);
    maj();
    window.addEventListener("online", maj);
    window.addEventListener("offline", maj);
    return () => {
      window.removeEventListener("online", maj);
      window.removeEventListener("offline", maj);
    };
  }, []);

  const quitter = async () => {
    try {
      await createClient().auth.signOut();
    } catch {
      /* on route de toute façon */
    }
    router.push("/logout");
    router.refresh();
  };

  const rafraichir = () => {
    setSynchro(true);
    router.refresh();
    setTimeout(() => setSynchro(false), 700);
  };

  return (
    <div className="min-h-screen bg-[#f5f6f2] text-[#1a1d23]">
      {/* ══ Bandeau ══
          La barre de couleur de l'atelier court sur toute la largeur :
          c'est le repère le plus rapide de l'écran. */}
      <div className="h-1.5 w-full" style={{ background: accent }} />

      <header className="sticky top-0 z-30 border-b border-black/[0.04] bg-[#f5f6f2]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-4 py-3 sm:px-6">
          {/* Le sélecteur d'atelier : c'est le seul « menu » dont
              l'ouvrier a besoin. */}
          <button
            onClick={() => setNavOuverte((v) => !v)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-black/[0.06] bg-white text-[#6b7280] shadow-sm transition-colors hover:text-[#1a1d23] active:scale-95"
            aria-label="Changer d'atelier"
            title="Changer d'atelier"
          >
            <LayoutGrid size={19} />
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-bold uppercase tracking-[0.22em] text-[#9ca3af]">
              {fiche ? `${fiche.usine} · Portail ${fiche.code}` : "Portail ateliers"}
            </p>
            <h1 className="truncate text-[17px] font-extrabold tracking-tight sm:text-[20px]">
              {fiche ? (
                <>
                  <span className="mr-1.5">{fiche.emoji}</span>
                  {fiche.court}
                  {enAttente > 0 && (
                    <span
                      className="ml-2 rounded-full px-2 py-0.5 align-middle text-[11px] font-black text-white"
                      style={{ background: accent }}
                    >
                      {enAttente}
                    </span>
                  )}
                </>
              ) : (
                "Mes ateliers"
              )}
            </h1>
            {(sousTitre ?? fiche?.role) && (
              <p className="hidden truncate text-[12px] text-[#9ca3af] sm:block">{sousTitre ?? fiche?.role}</p>
            )}
          </div>

          {/* Qui je suis */}
          <div className="hidden items-center gap-2 rounded-2xl border border-black/[0.06] bg-white px-3 py-2 shadow-sm sm:flex">
            <span
              className="grid h-7 w-7 place-items-center rounded-full text-[12px] font-black text-white"
              style={{ background: accent }}
            >
              {nom.trim().charAt(0).toUpperCase() || <User size={13} />}
            </span>
            <div className="leading-tight">
              <p className="max-w-[130px] truncate text-[12px] font-bold">{nom}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af]">
                {visiteur ? "Administrateur" : fiche ? fiche.code : "—"}
              </p>
            </div>
          </div>

          {/* Le scan des QR n'a pas disparu : il a simplement cessé
              d'être la porte d'entrée. Il reste à un clic, sur le
              premier poste de l'atelier — c'est de là que l'ouvrier
              scanne sa feuille de route. */}
          {fiche && (
            <Link
              href={`/portal?atelier=${fiche.id}&etape=${fiche.gammes[0]?.ordre ?? 1}`}
              className="hidden h-11 w-11 shrink-0 place-items-center rounded-2xl border border-black/[0.06] bg-white text-[#6b7280] shadow-sm transition-colors hover:text-[#1a1d23] active:scale-95 sm:grid"
              title="Scanner un QR de poste"
            >
              <QrCode size={17} />
            </Link>
          )}

          <button
            onClick={rafraichir}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-black/[0.06] bg-white text-[#6b7280] shadow-sm transition-colors hover:text-[#1a1d23] active:scale-95"
            title="Rafraîchir"
          >
            <RotateCw size={17} className={synchro ? "animate-spin" : ""} />
          </button>

          <button
            onClick={quitter}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-black/[0.06] bg-white text-[#6b7280] shadow-sm transition-colors hover:text-[#c24a08] active:scale-95"
            title="Se déconnecter"
          >
            <LogOut size={17} />
          </button>
        </div>

        {/* Bandeau hors-ligne : discret, mais il explique pourquoi un
            bouton peut ne rien faire. */}
        {!enLigne && (
          <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-center text-[12px] font-bold text-amber-700">
            Hors ligne — vos déclarations partiront au retour du réseau.
          </div>
        )}
      </header>

      {/* ══ Le choix de l'atelier ══ */}
      {navOuverte && (
        <div className="fixed inset-0 z-50" onClick={() => setNavOuverte(false)}>
          <div className="absolute inset-0 bg-black/25 backdrop-blur-sm" />
          <div
            className="absolute inset-x-0 top-0 max-h-[85vh] overflow-y-auto rounded-b-3xl bg-[#fafbf9] p-5 shadow-2xl sm:inset-x-auto sm:left-6 sm:top-6 sm:w-[420px] sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.22em] text-[#9ca3af]">
              Choisir un atelier
            </p>
            {USINES_AFFICHEES.map((u) => (
              <div key={u.code} className="mb-5">
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: u.accent }} />
                  <p className="text-[13px] font-black tracking-tight" style={{ color: u.accent }}>
                    {u.nom}
                  </p>
                  <span className="text-[11px] text-[#b0b5bf]">{u.sousTitre}</span>
                </div>
                <div className="grid gap-2">
                  {fichesParUsine(u.code).map((f) => {
                    const actif = pathname === urlAtelier(f.id);
                    return (
                      <Link
                        key={f.slug}
                        href={urlAtelier(f.id)}
                        className={cn(
                          "flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition-all",
                          actif ? "border-transparent shadow-sm" : "border-black/[0.06] bg-white hover:border-black/[0.12]",
                        )}
                        style={actif ? { background: `${f.accent}12`, boxShadow: `inset 0 0 0 1px ${f.accent}40` } : undefined}
                      >
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg" style={{ background: `${f.accent}14` }}>
                          {f.emoji}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-bold" style={{ color: actif ? f.accent : "#1a1d23" }}>
                            {f.code} — {f.court}
                          </span>
                          <span className="block truncate text-[11px] text-[#9ca3af]">
                            {f.gammes.length} postes
                          </span>
                        </span>
                        {actif && (
                          <span className="shrink-0 text-[10px] font-black uppercase tracking-wider" style={{ color: f.accent }}>
                            Ici
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Les autres ateliers restent visibles mais grisés : un
                ouvrier doit pouvoir constater qu'ils existent, sans
                pouvoir y entrer. */}
            <p className="mt-2 rounded-xl bg-black/[0.02] px-3 py-2 text-[11px] leading-relaxed text-[#9ca3af]">
              Votre compte ouvre l'atelier auquel vous êtes affecté. Les autres vous sont signalés par un
              message d'erreur si vous essayez d'y entrer.
            </p>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-[1200px] px-4 py-5 sm:px-6">{children}</main>

      {/* Barre d'ateliers en bas, sur mobile : le geste le plus fréquent
          est de vérifier « suis-je sur le bon poste ». */}
      <nav className="sticky bottom-0 z-20 border-t border-black/[0.05] bg-[#fafbf9]/95 backdrop-blur-xl sm:hidden">
        <div className="flex overflow-x-auto no-scrollbar">
          {FICHES_ATELIERS.map((f) => {
            const actif = pathname === urlAtelier(f.id);
            return (
              <Link
                key={f.slug}
                href={urlAtelier(f.id)}
                className="flex min-w-[76px] flex-1 flex-col items-center gap-1 px-3 py-2.5"
                style={actif ? { color: f.accent } : { color: "#b0b5bf" }}
              >
                <span className="text-[17px]">{f.emoji}</span>
                <span className="text-[10px] font-black uppercase tracking-wider">{f.code}</span>
                <span className="h-1 w-6 rounded-full" style={{ background: actif ? f.accent : "transparent" }} />
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
