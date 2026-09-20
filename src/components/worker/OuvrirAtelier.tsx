import Link from "next/link";
import { ArrowLeft, ArrowRight, UserCheck } from "lucide-react";
import { urlPortailUsine, type FicheAtelier } from "@/lib/portail-atelier";

// ═══════════════════════════════════════════════════════════
// OUVRIR UN ATELIER — un seul bouton
//
// ── Ce qu'il y avait avant ──
// Un identifiant, un mot de passe, et un message d'erreur. Sur un
// poste d'atelier, cela voulait dire : un mot de passe à retenir,
// à retrouver, à retaper à chaque changement d'équipe, et à
// réinitialiser dès qu'un ouvrier l'oubliait — c'est-à-dire tout le
// temps. Le coût n'était pas la saisie, c'était le poste arrêté.
//
// ── Ce qu'il y a maintenant ──
// L'écran dit à quel atelier il ouvre, et il ouvre. Rien à taper.
//
// ── Ce qui protège quand même ──
// Cette porte-ci est ouverte par conception : elle est DERRIÈRE le
// choix de l'usine, et elle ne donne accès qu'à UNE file de poste.
// Le pilotage — /admin, les prix, les clients, les comptes — reste
// fermé par mot de passe et par rôle. Un ouvrier qui ouvrirait
// l'atelier voisin ne verrait que l'atelier voisin.
//
// ── La gamme est affichée, pas décorative ──
// C'est le repère qui évite la faute la plus coûteuse du système :
// déclarer une pièce au poste d'à côté. On montre la gamme RÉELLE de
// l'atelier, pas un slogan.
// ═══════════════════════════════════════════════════════════

export default function OuvrirAtelier({ fiche }: { fiche: FicheAtelier }) {
  const accent = fiche.accent;

  return (
    <div className="grid min-h-screen bg-[#f5f6f2] lg:grid-cols-[1fr_1.05fr]">
      {/* ══════ Panneau gauche : l'identité de l'atelier ══════ */}
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
        <div
          className="absolute -right-20 top-1/4 h-[360px] w-[360px] rounded-full blur-[120px]"
          style={{ background: `${accent}33` }}
        />

        <div className="relative z-10 flex h-full flex-col">
          <Link
            href={urlPortailUsine(fiche.usine)}
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-white/12 bg-white/[0.05] px-3.5 py-2 text-[12.5px] font-bold text-white/70 backdrop-blur-sm transition-colors hover:text-white"
          >
            <ArrowLeft size={14} /> Ateliers {fiche.usine}
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

      {/* ══════ Panneau droit : un bouton ══════ */}
      <section className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[420px]">
          <div className="animate-fade-up">
            <div className="mb-6">
              <div className="mb-3 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: accent }} />
                <span className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: accent }}>
                  Poste de production
                </span>
              </div>
              <h2 className="text-[27px] font-extrabold tracking-tight text-[#1a1d23]">
                Ouvrir {fiche.code}
              </h2>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#7c8091]">
                Aucun identifiant à saisir. Le poste ouvre directement la file de{" "}
                <b className="text-[#1a1d23]">{fiche.code} — {fiche.court}</b>.
              </p>
            </div>

            <Link
              href={`/ouvrir/${fiche.slug}`}
              prefetch={false}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl px-4 py-4 text-[15px] font-black text-white shadow-lg transition-all hover:opacity-95 active:scale-[0.99]"
              style={{ background: accent, boxShadow: `0 12px 28px -14px ${accent}` }}
            >
              Entrer <ArrowRight size={18} />
            </Link>

            {/* ══ L'erreur la plus fréquente sur une tablette partagée :
                l'ouvrier ouvre le portail du voisin. On le dit AVANT
                qu'il entre, pas après. ══ */}
            <div className="mt-6 rounded-2xl border border-black/[0.05] bg-white px-4 py-3.5 shadow-sm">
              <p className="flex items-center gap-1.5 text-[12px] font-bold text-[#6b7280]">
                <UserCheck size={13} className="text-[#b0b5bf]" /> Ce n&apos;est pas votre atelier ?
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-[#9ca3af]">
                Chaque porte n&apos;ouvre que son atelier. Si vous vous êtes trompé, revenez en arrière :{" "}
                <Link
                  href={urlPortailUsine(fiche.usine)}
                  className="font-bold text-[#7c8091] underline decoration-dotted"
                >
                  les ateliers {fiche.usine}
                </Link>
                .
              </p>
            </div>

            <p className="mt-5 text-center text-[11.5px] leading-relaxed text-[#b0b5bf]">
              Le pilotage — direction, chefs d&apos;atelier, magasin — demande un compte :{" "}
              <Link href="/login" className="font-bold text-[#9ca3af] underline decoration-dotted">
                accès gestion
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
