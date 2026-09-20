import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, SearchX } from "lucide-react";
import ConnexionAtelier from "@/components/worker/ConnexionAtelier";
import { getProfil } from "@/lib/auth";
import {
  FICHES_ATELIERS,
  atelierDuSlug,
  ficheAtelier,
  urlAtelier,
  urlPortailUsine,
  usineDuSegment,
} from "@/lib/portail-atelier";

export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════
// /portail/<usine>/<code> — LA PORTE D'UN ATELIER
//
//   /portail/admedco/a1   ADMEDCO   Tôle & Gros œuvre    (id 1)
//   /portail/admedco/a2   ADMEDCO   Bureau               (id 2)
//   /portail/admedco/a3   ADMEDCO   Poudrage & Emballage (id 4)  ← pas 3 !
//   /portail/mobilix/m1   MOBILIX   Découpe bois         (id 3)  ← pas 4 !
//   /portail/mobilix/m2   MOBILIX   Tapissage            (id 5)
//
// ── L'usine est vérifiée, pas décorative ──
// `/portail/admedco/m1` désigne un atelier MOBILIX depuis le portail
// ADMEDCO : c'est une adresse incohérente, et on la refuse. Sans ce
// contrôle, le chemin « admedco » ne serait qu'un ornement d'URL, et
// l'ouvrier croirait s'être connecté à la mauvaise usine.
//
// ── Déjà connecté ? ──
// On n'affiche pas un formulaire à quelqu'un qui a déjà une session :
// on l'ouvre sur l'atelier. Si ce n'est pas le sien, la page d'atelier
// le lui dit en toutes lettres et lui propose le sien.
// ═══════════════════════════════════════════════════════════

export default async function PageConnexionAtelier({
  params,
}: {
  params: { usine: string; slug: string };
}) {
  const slug = (params?.slug ?? "").trim().toLowerCase();
  const id = atelierDuSlug(slug);
  const fiche = id ? ficheAtelier(id) : null;

  if (!fiche || !id) return <AtelierIntrouvable slug={slug} />;

  // L'usine du chemin doit être celle de l'atelier.
  const usineDemandee = usineDuSegment(params?.usine);
  if (!usineDemandee || usineDemandee !== fiche.usine) {
    redirect(urlPortailUsine(fiche.usine));
  }

  const profil = await getProfil();
  if (profil.email) redirect(urlAtelier(id));

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
          L&apos;adresse{" "}
          <span className="rounded bg-black/[0.04] px-1.5 py-0.5 font-mono text-[12.5px] text-[#6b7280]">
            /portail/{"{usine}"}/{slug}
          </span>{" "}
          ne correspond à aucun poste. Les ateliers sont&nbsp;:
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {FICHES_ATELIERS.map((f) => (
            <Link
              key={f.slug}
              href={urlPortailUsine(f.usine)}
              className="rounded-xl border border-black/[0.08] bg-white px-3.5 py-2 text-[12.5px] font-bold text-[#6b7280] transition-colors hover:text-[#1a1d23]"
            >
              <span style={{ color: f.accent }}>{f.code}</span> · {f.court}
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
