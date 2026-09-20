import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, SearchX } from "lucide-react";
import ConnexionAtelier from "@/components/worker/ConnexionAtelier";
import { getProfil } from "@/lib/auth";
import { atelierDuSlug, ficheAtelier, tousLesSlugs, urlAtelier } from "@/lib/portail-atelier";

export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════
// /portail/<code> — LA PORTE D'UN ATELIER
//
//   /portail/a1  ADMEDCO  Tôle & Gros œuvre   (id 1)
//   /portail/a2  ADMEDCO  Bureau              (id 2)
//   /portail/a3  ADMEDCO  Poudrage & Emballage(id 4)  ← pas 3 !
//   /portail/m1  MOBILIX  Découpe bois        (id 3)  ← pas 4 !
//   /portail/m2  MOBILIX  Tapissage           (id 5)
//
// ── Déjà connecté ? ──
// On n'affiche pas un formulaire à quelqu'un qui a déjà une session :
// on l'ouvre sur l'atelier. Si ce n'est pas le sien, la page d'atelier
// le lui dit en toutes lettres et lui propose le sien — c'est un
// message utile, pas un cul-de-sac.
//
// ── Slug inconnu ──
// `/portail/atelier-1`, `/portail/a4` : on l'explique au lieu de
// rediriger en silence. Quelqu'un qui tape une adresse à la main a
// une raison de le faire, et une redirection muette vers la page
// d'accueil lui ferait croire à une panne.
// ═══════════════════════════════════════════════════════════

export default async function PageConnexionAtelier({ params }: { params: { slug: string } }) {
  const slug = (params?.slug ?? "").trim().toLowerCase();
  const id = atelierDuSlug(slug);
  const fiche = id ? ficheAtelier(id) : null;

  if (!fiche) return <AtelierIntrouvable slug={slug} />;

  const profil = await getProfil();
  if (profil.email) redirect(urlAtelier(fiche.id));

  return <ConnexionAtelier fiche={fiche} />;
}

function AtelierIntrouvable({ slug }: { slug: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-[#f5f6f2] p-6">
      <div className="w-full max-w-lg rounded-3xl border border-black/[0.05] bg-white p-7 shadow-sm">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-black/[0.04] text-[#7c8091]">
          <SearchX size={26} />
        </div>
        <h1 className="mt-4 text-[20px] font-extrabold tracking-tight text-[#1a1d23]">
          Cet atelier n&apos;existe pas
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-[#7c8091]">
          L&apos;adresse <span className="rounded bg-black/[0.04] px-1.5 py-0.5 font-mono text-[12.5px] text-[#6b7280]">/portail/{slug}</span>{" "}
          ne correspond à aucun poste. Les ateliers seuls sont&nbsp;:
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {tousLesSlugs.map((s) => (
            <Link
              key={s}
              href={`/portail/${s}`}
              className="rounded-xl border border-black/[0.08] bg-white px-3.5 py-2 font-mono text-[13px] font-bold text-[#6b7280] transition-colors hover:text-[#1a1d23]"
            >
              {s}
            </Link>
          ))}
        </div>
        <Link
          href="/portail"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#4a7c59] px-4 py-3 text-[13px] font-black text-white"
        >
          <ArrowLeft size={15} /> Voir les deux usines
        </Link>
      </div>
    </div>
  );
}
