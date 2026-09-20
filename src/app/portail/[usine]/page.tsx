import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ChevronRight, Users } from "lucide-react";
import { getProfil } from "@/lib/auth";
import {
  FICHES_ATELIERS,
  fichesParUsine,
  urlConnexionAtelier,
  usineDuSegment,
  type FicheAtelier,
} from "@/lib/portail-atelier";

export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════
// /portail/<usine> — LES ATELIERS D'UNE USINE
//
//   /portail/admedco   →  A1 Tôle · A2 Bureau · A3 Poudrage
//   /portail/mobilix   →  M1 Découpe bois · M2 Tapissage
//
// ── Un écran, une question ──
// « Dans quel atelier travaillez-vous ? » — et rien d'autre. Les
// ateliers de l'AUTRE usine ne sont pas grisés, pas affichés en
// petit : ils ne sont pas là du tout. C'est la séparation la plus
// lisible qu'on puisse offrir, et elle est portée par l'URL.
//
// ── Compatibilité ──
// `/portail/a1` — l'ancienne adresse, où l'atelier était directement
// sous /portail — est reconnue ici et renvoyée vers sa vraie place.
// Dans une usine, une adresse qui marchait hier et qui casse
// aujourd'hui passe pour une panne, pas pour un changement d'URL.
// ═══════════════════════════════════════════════════════════

export default async function PagePortailUsine({ params }: { params: { usine: string } }) {
  const segment = (params?.usine ?? "").trim().toLowerCase();

  // ── Ancienne adresse : /portail/a1, /portail/m2… ──
  // L'atelier vivait directement sous /portail avant que l'usine ne
  // s'intercale. On le renvoie à sa vraie place — en cherchant dans la
  // TABLE des fiches, jamais en décodant le slug par calcul, sinon
  // `a3` finirait sur l'id 3 (qui est MOBILIX 1).
  const atelierDirect = FICHES_ATELIERS.find((f) => f.slug === segment);
  if (atelierDirect) redirect(urlConnexionAtelier(atelierDirect.id));

  const usine = usineDuSegment(segment);
  if (!usine) redirect("/portail");

  const profil = await getProfil();
  const fiches = fichesParUsine(usine);
  const accent = fiches[0]?.accent ?? "#4a7c59";

  return (
    <div className="min-h-screen bg-[#f5f6f2] text-[#1a1d23]">
      <div className="h-2 w-full" style={{ background: accent }} />

      <div className="mx-auto max-w-[1000px] px-4 py-8 sm:px-6 sm:py-10">
        {/* ── Fil d'Ariane ── */}
        <nav className="mb-6 flex items-center gap-2 text-[12px] font-semibold text-[#9ca3af]">
          <Link href="/portail" className="transition-colors hover:text-[#6b7280]">
            Portails
          </Link>
          <span>/</span>
          <span style={{ color: accent }}>{usine}</span>
        </nav>

        <header className="mb-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <span
                className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-[26px]"
                style={{ background: `${accent}14` }}
              >
                {usine === "MOBILIX" ? "🪵" : "🏭"}
              </span>
              <div>
                <p className="text-[10.5px] font-black uppercase tracking-[0.24em] text-[#b0b5bf]">
                  Portail
                </p>
                <h1 className="mt-0.5 text-[28px] font-black leading-tight tracking-tight sm:text-[34px]">
                  {usine}
                </h1>
                <p className="mt-1.5 max-w-md text-[13.5px] leading-relaxed text-[#7c8091]">
                  Dans quel atelier travaillez-vous&nbsp;? Vous vous connectez sur le vôtre et vous
                  arrivez directement sur votre file.
                </p>
              </div>
            </div>
          </div>

          {profil.email && (
            <p className="mt-5 inline-flex flex-wrap items-center gap-2 rounded-2xl border border-black/[0.05] bg-white px-4 py-2.5 text-[12px] shadow-sm">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[#4a7c59] text-[11px] font-black text-white">
                {(profil.full_name ?? profil.email).trim().charAt(0).toUpperCase()}
              </span>
              <span className="font-bold">{profil.full_name ?? profil.email}</span>
              <span className="text-[#b0b5bf]">—</span>
              <span className="text-[#9ca3af]">
                {profil.role === "ADMIN" ? "Administrateur" : "Opérateur"}
              </span>
            </p>
          )}
        </header>

        {/* ══ Les ateliers de CETTE usine ══ */}
        <div className="grid gap-4 sm:grid-cols-2">
          {fiches.map((f) => (
            <CarteAtelier key={f.slug} fiche={f} />
          ))}
        </div>

        {fiches.length === 1 && (
          <p className="mt-4 rounded-2xl border border-black/[0.05] bg-white px-4 py-3 text-[12px] leading-relaxed text-[#9ca3af] shadow-sm">
            <Users size={13} className="mr-1.5 inline text-[#b0b5bf]" />
            {usine} ne compte qu&apos;un atelier pour l&apos;instant.
          </p>
        )}

        <Link
          href="/portail"
          className="mt-6 inline-flex items-center gap-2 rounded-xl border border-black/[0.08] bg-white px-4 py-3 text-[12.5px] font-bold text-[#6b7280] transition-colors hover:text-[#1a1d23]"
        >
          <ArrowLeft size={15} /> L&apos;autre usine
        </Link>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// UN ATELIER
// ───────────────────────────────────────────────────────────
function CarteAtelier({ fiche }: { fiche: FicheAtelier }) {
  return (
    <Link
      // ── Un clic, et l'atelier est ouvert ──
      // On va droit à /ouvrir/<slug>, qui pose la session et redirige
      // vers la file. L'écran de confirmation
      // (/portail/<usine>/<slug>) reste en place pour les adresses
      // mises en favori sur les tablettes : il mène au même endroit,
      // avec le nom et la gamme de l'atelier sous les yeux.
      href={`/ouvrir/${fiche.slug}`}
      prefetch={false}
      className="group flex flex-col rounded-3xl border border-black/[0.05] bg-white p-5 transition-all hover:-translate-y-0.5"
      style={{ boxShadow: `0 1px 2px rgba(0,0,0,.04), 0 14px 32px -20px ${fiche.accent}` }}
    >
      <div className="flex items-start gap-3.5">
        <span
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-[22px]"
          style={{ background: `${fiche.accent}14` }}
        >
          {fiche.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="rounded-md px-1.5 py-0.5 text-[10px] font-black tracking-wider text-white"
              style={{ background: fiche.accent }}
            >
              {fiche.code}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#b0b5bf]">
              {fiche.gammes.length} postes
            </span>
          </div>
          <p className="mt-1.5 text-[17px] font-extrabold leading-tight tracking-tight">
            {fiche.court}
          </p>
        </div>
      </div>

      <p className="mt-3.5 flex-1 text-[12.5px] leading-relaxed text-[#7c8091]">{fiche.role}</p>

      {/* Les postes, en lecture seule : la preuve d'identité de
          l'atelier. Un ouvrier reconnaît le sien à ses étapes. */}
      <div className="mt-3.5 flex flex-wrap gap-1.5">
        {fiche.gammes.slice(0, 4).map((g) => (
          <span
            key={`${g.ordre}-${g.code}`}
            className="rounded-lg px-2 py-1 text-[10.5px] font-semibold"
            style={{ background: `${fiche.accent}0d`, color: fiche.accent }}
          >
            {g.ordre}. {g.nom}
          </span>
        ))}
        {fiche.gammes.length > 4 && (
          <span className="rounded-lg bg-black/[0.04] px-2 py-1 text-[10.5px] font-semibold text-[#9ca3af]">
            +{fiche.gammes.length - 4}
          </span>
        )}
      </div>

      <span
        className="mt-4 inline-flex items-center gap-1 text-[13px] font-black transition-transform group-hover:translate-x-0.5"
        style={{ color: fiche.accent }}
      >
        Se connecter <ChevronRight size={15} />
      </span>
    </Link>
  );
}