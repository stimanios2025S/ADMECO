import Link from "next/link";
import { ArrowRight, ChevronRight, Factory, LogIn, ShieldCheck } from "lucide-react";
import { getProfil, routeApresLogin } from "@/lib/auth";
import {
  USINES_AFFICHEES,
  fichesParUsine,
  segmentUsine,
  urlPortailUsine,
} from "@/lib/portail-atelier";

export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════
// /portail — DEUX USINES, DEUX PORTAILS
//
// ── La règle de cet écran ──
// Il y a exactement DEUX choses à choisir ici : ADMEDCO, ou MOBILIX.
// Rien d'autre. Pas de liste d'ateliers, pas de raccourci, pas de
// mélange : l'ouvrier dit d'abord pour quelle usine il travaille, et
// c'est seulement ensuite qu'on lui demande son atelier.
//
//        ┌────────────────┐   ┌────────────────┐
//        │    ADMEDCO     │   │    MOBILIX     │
//        │ 3 ateliers     │   │ 2 ateliers     │
//        │ Ouvrir ──►     │   │ Ouvrir ──►     │
//        └────────────────┘   └────────────────┘
//
// ── Pourquoi cette page est PUBLIQUE ──
// Un poste de travail s'ouvre sur une tablette partagée, souvent
// après une déconnexion. Si l'écran d'accueil exigeait une session,
// l'ouvrier suivant tomberait sur une page vide sans savoir quoi
// faire. Ici il voit les deux usines — et rien de la production : ni
// file, ni quantité, ni client. Ces données ne sortent qu'après
// connexion, et jamais au-delà de son atelier.
// ═══════════════════════════════════════════════════════════

export default async function PagePortail() {
  const profil = await getProfil();
  const connecte = Boolean(profil.email);

  return (
    <div className="min-h-screen bg-[#f5f6f2] text-[#1a1d23]">
      {/* ══ Bandeau ══ */}
      <header className="relative overflow-hidden bg-gradient-to-br from-[#1a2e1f] via-[#1a2420] to-[#0f1a12] px-4 pb-16 pt-10 sm:pb-24 sm:pt-14">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />
        <div className="absolute -top-24 left-1/4 h-[420px] w-[420px] rounded-full bg-[#4a7c59]/12 blur-[120px]" />
        <div className="absolute -bottom-32 right-1/4 h-[320px] w-[320px] rounded-full bg-[#7c3aed]/12 blur-[110px]" />

        <div className="relative z-10 mx-auto max-w-[1000px]">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#4a7c59] text-xl shadow-lg shadow-[#4a7c59]/30">
                🪑
              </div>
              <div>
                <p className="text-[17px] font-extrabold tracking-tight text-white">
                  ADMEDCO <span className="text-[#6fa67d]">MES</span>
                </p>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-white/35">
                  Portail de connexion
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
              <span className="live-dot h-2 w-2 rounded-full bg-[#6fa67d]" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#6fa67d]">
                Production en ligne
              </span>
            </div>
          </div>

          <h1 className="relative mt-9 max-w-2xl text-[32px] font-black leading-[1.1] tracking-tight text-white sm:text-[44px]">
            Choisissez votre usine.
          </h1>
          <p className="relative mt-3 max-w-xl text-[14.5px] leading-relaxed text-white/50">
            Deux usines, deux portails. Vous entrez sur le vôtre, puis vous ouvrez votre atelier.
          </p>

          {/* ── Déjà connecté ── */}
          {connecte && (
            <div className="mt-7 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-3.5 backdrop-blur-sm">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#4a7c59] text-[13px] font-black text-white">
                {(profil.full_name ?? profil.email ?? "?").trim().charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-[13px] font-bold text-white">
                  {profil.full_name ?? profil.email}
                </p>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
                  {profil.role === "ADMIN"
                    ? "Administrateur — accès aux deux usines"
                    : profil.role === "MAGASINIER"
                      ? "Magasinier — Réception matière première"
                      : "Opérateur"}
                </p>
              </div>
              <Link
                href={routeApresLogin(profil)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#4a7c59] px-4 py-2.5 text-[12.5px] font-black text-white transition-opacity hover:opacity-90"
              >
                Reprendre <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* ══ Les deux portails ══ */}
      <main className="mx-auto -mt-10 max-w-[1000px] px-4 pb-14 sm:-mt-16 sm:px-6">
        <div className="grid gap-5 sm:grid-cols-2">
          {USINES_AFFICHEES.map((u) => (
            <CarteUsine key={u.code} usine={u} />
          ))}
        </div>

        {/* ══ La porte de la gestion ══ */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-black/[0.05] bg-white px-5 py-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-black/[0.04] text-[#7c8091]">
              <ShieldCheck size={17} />
            </span>
            <div>
              <p className="text-[13px] font-bold">Compte de gestion</p>
              <p className="text-[12px] leading-relaxed text-[#9ca3af]">
                Direction, chef d&apos;atelier, magasinier : le pilotage complet est ailleurs.
              </p>
            </div>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 rounded-xl border border-black/[0.08] bg-white px-4 py-2.5 text-[12.5px] font-bold text-[#6b7280] transition-colors hover:text-[#1a1d23]"
          >
            <LogIn size={14} /> Accéder au pilotage
          </Link>
        </div>

        <p className="mt-5 flex items-start gap-2 text-[11.5px] leading-relaxed text-[#9ca3af]">
          <Factory size={13} className="mt-0.5 shrink-0" />
          <span>
            Un opérateur n&apos;ouvre que l&apos;atelier auquel son compte est rattaché. Pour changer
            quelqu&apos;un de poste, l&apos;administrateur passe par{" "}
            <span className="font-mono text-[#7c8091]">/admin/team</span>.
          </span>
        </p>
      </main>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// UN PORTAIL D'USINE
// ───────────────────────────────────────────────────────────
function CarteUsine({ usine }: { usine: (typeof USINES_AFFICHEES)[number] }) {
  const fiches = fichesParUsine(usine.code);

  return (
    <Link
      href={urlPortailUsine(usine.code)}
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-black/[0.05] bg-white transition-all hover:-translate-y-1"
      style={{ boxShadow: `0 1px 2px rgba(0,0,0,.04), 0 18px 40px -22px ${usine.accent}` }}
    >
      {/* La bande de couleur : le repère le plus rapide de l'écran */}
      <div className="h-2 w-full" style={{ background: usine.accent }} />

      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-start gap-4">
          <span
            className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-[26px]"
            style={{ background: `${usine.accent}14` }}
          >
            {usine.code === "MOBILIX" ? "🪵" : "🏭"}
          </span>
          <div className="min-w-0 flex-1">
            <h2
              className="text-[24px] font-black leading-none tracking-tight"
              style={{ color: usine.accent }}
            >
              {usine.nom}
            </h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#7c8091]">{usine.sousTitre}</p>
          </div>
        </div>

        {/* Ce qu'on trouve dedans — en lecture seule. Un ouvrier doit
            pouvoir reconnaître son usine d'un coup d'œil, sans qu'on
            lui ouvre pour autant la liste des ateliers ici : ce choix
            se fait à l'écran suivant, et à un seul endroit. */}
        <div className="mt-5 space-y-1.5">
          {fiches.map((f) => (
            <div key={f.slug} className="flex items-center gap-2.5">
              <span
                className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[10px] font-black text-white"
                style={{ background: f.accent }}
              >
                {f.code}
              </span>
              <span className="truncate text-[12.5px] font-semibold text-[#6b7280]">{f.court}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-black/[0.05] pt-4">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#b0b5bf]">
            {fiches.length} atelier{fiches.length > 1 ? "s" : ""}
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-black text-white transition-transform group-hover:translate-x-0.5"
            style={{ background: usine.accent }}
          >
            Ouvrir le portail <ChevronRight size={15} />
          </span>
        </div>
      </div>
    </Link>
  );
}
