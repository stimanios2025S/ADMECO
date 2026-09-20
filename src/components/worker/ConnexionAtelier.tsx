"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Eye, EyeOff, KeyRound, Loader2, LogIn, ShieldAlert, User2, WifiOff,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { slugAtelier, urlAtelier, type FicheAtelier } from "@/lib/portail-atelier";

type Props = {
  fiche: FicheAtelier;
};

// ═══════════════════════════════════════════════════════════
// LA CONNEXION D'UN ATELIER
//
// ── Le parcours ──
// L'ouvrier a cliqué « A1 » sur /portail. Il ne retape pas son poste :
// l'écran porte déjà le nom, la couleur et la gamme de l'atelier. Il
// remplit deux champs — identifiant et mot de passe — et il arrive
// sur sa file.
//
// ── Une seule destination, décidée par le serveur ──
// Après `signInWithPassword`, on interroge `/api/mon-profil` : c'est
// la base qui dit à quel atelier ce compte appartient. On ne pousse
// jamais un ouvrier vers un atelier qu'il n'a pas, parce que les
// portails d'atelier refusent — et un refus juste après un mot de
// passe correct passe pour une panne. S'il s'est trompé d'atelier, on
// l'ouvre sur le sien.
//
//   ADMIN      → l'atelier cliqué (il navigue, il ne produit pas)
//   WORKER     → SON atelier, quelle que soit la porte d'entrée
//   MAGASINIER → la Réception MP
// ═══════════════════════════════════════════════════════════

/** Supabase répond en anglais. Un ouvrier lit en français. */
function traduire(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Identifiant ou mot de passe incorrect.";
  if (m.includes("email not confirmed")) return "Ce compte n'a pas encore été confirmé.";
  if (m.includes("too many requests") || m.includes("rate limit")) {
    return "Trop de tentatives. Patientez une minute avant de réessayer.";
  }
  if (m.includes("failed to fetch") || m.includes("network")) {
    return "Réseau injoignable. Vérifiez la connexion du poste.";
  }
  return message;
}

export default function ConnexionAtelier({ fiche }: Props) {
  const router = useRouter();
  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [voir, setVoir] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState("");
  const [horsLigne, setHorsLigne] = useState(false);

  const accent = fiche.accent;

  const connecter = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErreur("");

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setHorsLigne(true);
      setBusy(false);
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: identifiant.trim(),
        password: motDePasse,
      });

      if (error) {
        setErreur(traduire(error.message));
        setBusy(false);
        return;
      }

      // ── Qui vient d'entrer ? ──
      // La réponse du serveur prime sur l'atelier cliqué. Si ce
      // contrôle échoue (réseau), on retombe sur l'atelier demandé :
      // la page d'atelier refusera proprement le cas échéant.
      let destination = urlAtelier(fiche.id);
      try {
        const res = await fetch("/api/mon-profil", { cache: "no-store" });
        if (res.ok) {
          const p = (await res.json()) as {
            role?: string;
            atelier_id?: number | null;
          };
          if (p.role === "MAGASINIER") {
            destination = "/admin/reception";
          } else if (p.role !== "ADMIN") {
            const sien = slugAtelier(p.atelier_id ?? null);
            destination = sien ? `/atelier/${sien}` : "/atelier";
          }
        }
      } catch {
        /* on garde l'atelier cliqué */
      }

      router.push(destination);
      router.refresh();
    } catch {
      setErreur("Connexion impossible. Réessayez.");
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-[#f5f6f2] lg:grid-cols-[1fr_1.05fr]">
      {/* ══════ Panneau gauche : l'identité de l'atelier ══════
          C'est le repère qui évite la faute la plus coûteuse du
          système : déclarer une pièce au poste d'à côté. On montre la
          GAMME RÉELLE, pas un slogan. */}
      <section
        className="relative overflow-hidden px-6 py-9 text-white lg:px-11 lg:py-12"
        style={{ background: `linear-gradient(155deg, #16181d 0%, #1a1d23 55%, ${accent}44 100%)` }}
      >
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />
        <div className="absolute -right-20 top-1/4 h-[360px] w-[360px] rounded-full blur-[120px]" style={{ background: `${accent}33` }} />

        <div className="relative z-10 flex h-full flex-col">
          <Link
            href="/portail"
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-white/12 bg-white/[0.05] px-3.5 py-2 text-[12.5px] font-bold text-white/70 backdrop-blur-sm transition-colors hover:text-white"
          >
            <ArrowLeft size={14} /> Tous les ateliers
          </Link>

          <div className="mt-9 flex items-start gap-4">
            <span
              className="grid h-16 w-16 shrink-0 place-items-center rounded-3xl text-[30px] shadow-xl"
              style={{ background: `${accent}33`, boxShadow: `0 12px 32px -12px ${accent}` }}
            >
              {fiche.emoji}
            </span>
            <div className="min-w-0">
              <p className="text-[10.5px] font-black uppercase tracking-[0.24em] text-white/40">
                {fiche.usine} · Portail {fiche.code}
              </p>
              <h1 className="mt-1 text-[26px] font-black leading-[1.12] tracking-tight lg:text-[34px]">
                {fiche.court}
              </h1>
              <p className="mt-1.5 text-[11.5px] font-bold uppercase tracking-wider" style={{ color: accent }}>
                {fiche.nom}
              </p>
            </div>
          </div>

          <p className="mt-5 max-w-md text-[14px] leading-relaxed text-white/50">{fiche.role}</p>

          {/* La gamme : la preuve d'identité de l'atelier */}
          <div className="mt-8">
            <p className="text-[10.5px] font-black uppercase tracking-[0.22em] text-white/35">
              Ses {fiche.gammes.length} postes
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {fiche.gammes.map((g) => (
                <span
                  key={`${g.ordre}-${g.code}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.05] px-2.5 py-1.5 text-[11.5px] font-semibold text-white/75"
                >
                  <span className="font-black tabular-nums" style={{ color: accent }}>
                    {g.ordre}
                  </span>
                  {g.nom}
                </span>
              ))}
            </div>
          </div>

          <p className="mt-auto hidden pt-10 text-[11.5px] leading-relaxed text-white/25 lg:block">
            Ce que vous déclarez ici est écrit dans <span className="font-mono">work_order_steps</span> et
            apparaît aussitôt sur le poste de l&apos;atelier suivant.
          </p>
        </div>
      </section>

      {/* ══════ Panneau droit : le formulaire ══════ */}
      <section className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[400px]">
          <div className="animate-fade-up">
            <div className="mb-6">
              <div className="mb-3 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: accent }} />
                <span className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: accent }}>
                  Poste de production
                </span>
              </div>
              <h2 className="text-[27px] font-extrabold tracking-tight text-[#1a1d23]">Connexion</h2>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#7c8091]">
                Identifiez-vous pour ouvrir la file de{" "}
                <b className="text-[#1a1d23]">{fiche.code} — {fiche.court}</b>.
              </p>
            </div>

            <form onSubmit={connecter} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-[#7c8091]">Identifiant</label>
                <div className="relative">
                  <User2
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#b0b5bf]"
                  />
                  <input
                    required
                    type="email"
                    value={identifiant}
                    onChange={(e) => setIdentifiant(e.target.value)}
                    placeholder="prenom@admedco.ma"
                    autoComplete="username"
                    autoFocus
                    inputMode="email"
                    className="input w-full py-3.5 pl-10 pr-4 text-[15px]"
                    style={{ caretColor: accent }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-[#7c8091]">Mot de passe</label>
                <div className="relative">
                  <KeyRound
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#b0b5bf]"
                  />
                  <input
                    required
                    type={voir ? "text" : "password"}
                    value={motDePasse}
                    onChange={(e) => setMotDePasse(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="input w-full py-3.5 pl-10 pr-11 text-[15px]"
                    style={{ caretColor: accent }}
                  />
                  <button
                    type="button"
                    onClick={() => setVoir((v) => !v)}
                    className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-[#7c8091] transition-colors hover:text-[#1a1d23]"
                    aria-label={voir ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  >
                    {voir ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {(erreur || horsLigne) && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium leading-relaxed text-red-600">
                  {horsLigne ? (
                    <WifiOff size={15} className="mt-0.5 shrink-0" />
                  ) : (
                    <ShieldAlert size={15} className="mt-0.5 shrink-0" />
                  )}
                  <span>{horsLigne ? "Le poste est hors ligne. Reconnectez-le puis réessayez." : erreur}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={busy || !identifiant.trim() || !motDePasse}
                className="flex w-full items-center justify-center gap-2.5 rounded-xl px-4 py-4 text-[15px] font-black text-white shadow-lg transition-all hover:opacity-95 active:scale-[0.99] disabled:opacity-40"
                style={{ background: accent, boxShadow: `0 12px 28px -14px ${accent}` }}
              >
                {busy ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
                {busy ? "Connexion en cours…" : `Ouvrir ${fiche.code}`}
              </button>
            </form>

            {/* ══ Le piège ══
                L'erreur la plus fréquente sur une tablette partagée :
                l'ouvrier ouvre le portail du voisin. On le dit AVANT
                qu'il tape, pas après. */}
            <div className="mt-6 rounded-2xl border border-black/[0.05] bg-white px-4 py-3.5 shadow-sm">
              <p className="text-[12px] font-bold text-[#6b7280]">Ce n&apos;est pas votre atelier ?</p>
              <p className="mt-1 text-[12px] leading-relaxed text-[#9ca3af]">
                Votre identifiant ouvre toujours l&apos;atelier auquel vous êtes rattaché : si vous vous
                trompez de porte, vous serez quand même conduit sur le vôtre.{" "}
                <Link href="/portail" className="font-bold text-[#7c8091] underline decoration-dotted">
                  Changer d&apos;atelier
                </Link>
                .
              </p>
            </div>

            <p className="mt-5 text-center text-[11.5px] text-[#b0b5bf]">
              Mot de passe oublié ? Adressez-vous au chef d&apos;atelier.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
