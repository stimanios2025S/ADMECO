import Link from "next/link";
import { ArrowRight, ChevronRight, Factory, LogIn, ShieldCheck } from "lucide-react";
import { getProfil, routeApresLogin } from "@/lib/auth";
import {
  USINES_AFFICHEES,
  fichesParUsine,
  urlConnexionAtelier,
  type FicheAtelier,
} from "@/lib/portail-atelier";

export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════
// /portail — LA PORTE D'ENTRÉE
//
// ── Ce qu'on voit ──
// Deux usines, et sous chacune ses ateliers. Rien d'autre.
//
//        ADMEDCO                        MOBILIX
//      🪚 A1 Tôle & Gros œuvre        🪵 M1 Découpe bois
//      🔧 A2 Bureau                   🧵 M2 Tapissage
//      🎨 A3 Poudrage & Emballage
//
// L'ouvrier clique sur SON atelier, et le formulaire de connexion
// s'ouvre à la couleur de cet atelier. Il ne choisit pas son nom dans
// une liste après coup : il l'a déjà dit en cliquant.
//
// ── Pourquoi cette page est PUBLIQUE ──
// Un poste de travail s'ouvre sur une tablette partagée, souvent
// après une déconnexion. Si l'écran d'accueil exigeait une session,
// l'ouvrier suivant tomberait sur une page vide sans savoir quoi
// faire. Ici il voit l'usine entière — et rien de la production : ni
// file, ni quantité, ni client. Ces données-là ne sortent qu'après
// connexion, et jamais au-delà de son atelier.
//
// ── Le piège des identifiants ──
// A3 porte l'id 4, M1 porte l'id 3. On ne déduit jamais un id d'un
// numéro affiché : tout passe par `fichesParUsine`, qui lit la table
// explicite de lib/portail-atelier.ts.
// ═══════════════════════════════════════════════════════════

export default async function PagePortail() {
  const profil = await getProfil();
  const connecte = Boolean(profil.email);

  return (
    <div className="min-h-screen bg-[#f5f6f2] text-[#1a1d23]">
      {/* ══ Bandeau d'identité ══
          Le dégradé sombre reprend le panneau de /login : quelqu'un
          qui vient de la gestion reconnaît immédiatement l'application. */}
      <header className="relative overflow-hidden bg-gradient-to-br from-[#1a2e1f] via-[#1a2420] to-[#0f1a12] px-4 pb-14 pt-10 sm:pb-20 sm:pt-14">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />
        <div className="absolute -top-24 left-1/4 h-[420px] w-[420px] rounded-full bg-[#4a7c59]/12 blur-[120px]" />
        <div className="absolute -bottom-32 right-1/4 h-[320px] w-[320px] rounded-full bg-[#7c3aed]/12 blur-[110px]" />

        <div className="relative z-10 mx-auto max-w-[1100px]">
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

          <h1 className="relative mt-8 max-w-2xl text-[32px] font-black leading-[1.1] tracking-tight text-white sm:text-[44px]">
            Choisissez votre atelier.
          </h1>
          <p className="relative mt-3 max-w-xl text-[14.5px] leading-relaxed text-white/50">
            Chaque atelier a son portail : sa file de travail, ses postes, ses déclarations. Vous
            vous connectez sur le vôtre et vous arrivez directement dessus.
          </p>

          {/* ── Déjà connecté ──
              On ne renvoie pas l'utilisateur en silence : il peut très
              bien vouloir ouvrir l'atelier d'à côté. On lui propose de
              continuer là où il en était, et on lui dit qui il est. */}
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
                    ? "Administrateur — accès à tous les ateliers"
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

      {/* ══ Les deux usines ══
          Remontées en négatif sur le bandeau : c'est le seul relief de
          la page, et il sépare visuellement ADMEDCO de MOBILIX. */}
      <main className="mx-auto -mt-8 max-w-[1100px] px-4 pb-14 sm:-mt-12 sm:px-6">
        <div className="grid gap-5 lg:grid-cols-2">
          {USINES_AFFICHEES.map((u) => (
            <BlocUsine key={u.code} usine={u} />
          ))}
        </div>

        {/* ══ La porte de la gestion ══
            Un ouvrier n'a rien à faire ici, mais un chef d'atelier ou
            un magasinier qui atterrit sur cette page doit pouvoir
            entrer sans chercher. On la met donc en bas, discrète et
            explicite. */}
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
// UNE USINE, ET SES ATELIERS
// ───────────────────────────────────────────────────────────
function BlocUsine({ usine }: { usine: (typeof USINES_AFFICHEES)[number] }) {
  const fiches = fichesParUsine(usine.code);

  return (
    <section
      className="overflow-hidden rounded-3xl border border-black/[0.05] bg-white shadow-sm"
      style={{ boxShadow: `0 1px 2px rgba(0,0,0,.04), 0 12px 32px -18px ${usine.accent}55` }}
    >
      {/* En-tête de l'usine */}
      <div className="h-1.5 w-full" style={{ background: usine.accent }} />
      <div className="flex items-start gap-3 px-5 pb-4 pt-5">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[18px] font-black"
          style={{ background: `${usine.accent}14`, color: usine.accent }}
        >
          {usine.code === "MOBILIX" ? "🪵" : "🏭"}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[19px] font-black tracking-tight" style={{ color: usine.accent }}>
            {usine.nom}
          </h2>
          <p className="mt-0.5 text-[12.5px] text-[#9ca3af]">{usine.sousTitre}</p>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider"
          style={{ background: `${usine.accent}12`, color: usine.accent }}
        >
          {fiches.length} atelier{fiches.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Ses ateliers */}
      <div className="space-y-2 px-4 pb-5">
        {fiches.map((f, i) => (
          <LigneAtelier key={f.slug} fiche={f} numero={i + 1} usine={usine.accent} />
        ))}
      </div>
    </section>
  );
}

// ───────────────────────────────────────────────────────────
// UN ATELIER, SUR UNE LIGNE
// ───────────────────────────────────────────────────────────
function LigneAtelier({ fiche, numero, usine }: { fiche: FicheAtelier; numero: number; usine: string }) {
  return (
    <Link
      href={urlConnexionAtelier(fiche.id)}
      className="group flex items-center gap-3.5 rounded-2xl border border-black/[0.06] bg-white px-4 py-3.5 transition-all hover:-translate-y-px hover:shadow-md"
      style={{ borderColor: "rgba(0,0,0,.06)" }}
    >
      <span
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[19px]"
        style={{ background: `${fiche.accent}14` }}
      >
        {fiche.emoji}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span
            className="rounded-md px-1.5 py-0.5 text-[10px] font-black tracking-wider text-white"
            style={{ background: fiche.accent }}
          >
            {fiche.code}
          </span>
          <span className="truncate text-[15px] font-extrabold tracking-tight text-[#1a1d23]">
            {fiche.court}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-[11.5px] text-[#9ca3af]">
          {fiche.gammes.length} postes · {usine}
        </span>
      </span>

      <span
        className="inline-flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-[12px] font-black transition-colors"
        style={{ background: `${fiche.accent}0f`, color: fiche.accent }}
      >
        Se connecter
        <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
