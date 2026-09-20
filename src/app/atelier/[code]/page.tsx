import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { getProfil } from "@/lib/auth";
import { tachesAtelier, verifierAccesAtelier } from "@/app/actions-atelier";
import AtelierShell from "@/components/worker/AtelierShell";
import AtelierBoard from "@/components/worker/AtelierBoard";
import { atelierDuSlug, ficheAtelier, urlAtelier } from "@/lib/portail-atelier";

// Cette page lit la session ET la file de production : elle ne peut
// pas être pré-rendue, et elle ne doit jamais être mise en cache — un
// ouvrier qui voit sa liste d'il y a dix minutes déclarerait une étape
// déjà faite.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PageAtelier({ params }: { params: { code: string } }) {
  const profil = await getProfil();
  if (!profil.email) redirect("/portail");

  const slug = (params.code ?? "").toLowerCase();
  const fiche = ficheAtelier(atelierDuSlug(slug));

  // ── Le refus ──
  // On ne redirige PAS en silence vers son propre atelier : un ouvrier
  // qui a cliqué sur le mauvais poste doit comprendre pourquoi, sinon
  // il croit à une panne et rappelle le chef.
  const acces = await verifierAccesAtelier(slug);
  if (!acces.ok) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f5f6f2] p-6">
        <div className="w-full max-w-lg rounded-3xl border border-black/[0.05] bg-white p-7 shadow-sm">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-500">
            <ShieldAlert size={26} />
          </div>
          <h1 className="mt-4 text-[20px] font-extrabold tracking-tight text-[#1a1d23]">
            Cet atelier ne vous est pas ouvert
          </h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-[#7c8091]">{acces.message}</p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/atelier"
              className="inline-flex items-center gap-2 rounded-xl bg-[#4a7c59] px-4 py-3 text-[13px] font-black text-white"
            >
              <ArrowLeft size={15} /> Voir les ateliers
            </Link>
            {profil.atelier_id && (
              <Link
                href={urlAtelier(profil.atelier_id)}
                className="inline-flex items-center gap-2 rounded-xl border border-black/[0.08] bg-white px-4 py-3 text-[13px] font-bold text-[#6b7280]"
              >
                Aller à mon atelier
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  const r = await tachesAtelier(slug);
  if (!r.ok) {
    return (
      <AtelierShell fiche={fiche} nom={profil.full_name ?? profil.email ?? "Ouvrier"}>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="font-black text-[#1a1d23]">Impossible de charger votre poste</p>
          <p className="mt-2 rounded-xl bg-white/70 px-3 py-2 font-mono text-xs text-red-500">{r.message}</p>
          <p className="mt-3 text-[13px] text-[#7c8091]">
            Prévenez le chef d'atelier. Si le message parle de <span className="font-mono">profiles</span> ou de
            récursion, la réparation est la migration <b>0019</b>.
          </p>
        </div>
      </AtelierShell>
    );
  }

  const { taches, fiche: ficheReelle, stats } = r;
  const courante = ficheReelle ?? fiche;

  return (
    <AtelierShell
      fiche={courante}
      nom={r.profil.full_name ?? r.profil.email ?? "Ouvrier"}
      visiteur={r.profil.role === "ADMIN"}
      enAttente={taches.filter((t) => t.statut === "PENDING" && !t.bloquee).length}
      sousTitre={courante?.role}
    >
      {/* ══ Le bilan du jour ══
          Trois chiffres, en haut, avant tout le reste : l'ouvrier sait
          où il en est avant même de lire sa file. */}
      <section className="mb-5 rounded-2xl border border-black/[0.05] bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#9ca3af]">
              Aujourd'hui — {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <p className="mt-1 text-[17px] font-extrabold tracking-tight text-[#1a1d23]">
              Bonjour {prenom(r.profil.full_name)}
            </p>
            <p className="mt-0.5 text-[12.5px] text-[#9ca3af]">
              {courante
                ? `${courante.code} · ${courante.court} · ${courante.gammes.length} postes`
                : "Atelier inconnu"}
            </p>
          </div>

          <div className="flex gap-5">
            <ChiffreJour valeur={stats.finiesAujourdhui} libelle="Vos étapes finies" accent={courante?.accent ?? "#4a7c59"} />
            <ChiffreJour valeur={stats.piecesAujourdhui} libelle="Pièces réussies" accent="#4a7c59" />
            <ChiffreJour
              valeur={stats.rebutAujourdhui}
              libelle="Pièces perdues"
              accent={stats.rebutAujourdhui > 0 ? "#c24a08" : "#d6d9de"}
            />
          </div>
        </div>

        {r.profil.role === "ADMIN" && (
          <p className="mt-3 rounded-xl bg-[#2f6eb5]/[0.07] px-3 py-2 text-[12px] font-semibold text-[#2f6eb5]">
            Vous consultez cet atelier en administrateur. Vos déclarations seront enregistrées à votre nom.
          </p>
        )}
      </section>

      <AtelierBoard
        taches={taches}
        atelierId={courante?.id ?? 0}
        accent={courante?.accent ?? "#4a7c59"}
        nbPostes={courante?.gammes.length ?? 0}
      />
    </AtelierShell>
  );
}

function prenom(nom: string | null): string {
  const s = (nom ?? "").trim();
  if (!s) return "";
  return s.split(/\s+/)[0];
}

function ChiffreJour({ valeur, libelle, accent }: { valeur: number; libelle: string; accent: string }) {
  return (
    <div className="text-center">
      <p className="text-[26px] font-black leading-none tabular-nums" style={{ color: accent }}>
        {valeur}
      </p>
      <p className="mt-1 max-w-[90px] text-[10px] font-bold uppercase leading-tight tracking-wider text-[#9ca3af]">
        {libelle}
      </p>
    </div>
  );
}
