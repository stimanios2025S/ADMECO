import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight, LogOut, ShieldAlert } from "lucide-react";
import { getProfil } from "@/lib/auth";
import { slugAtelier, urlAtelier, USINES_AFFICHEES, fichesParUsine, type FicheAtelier } from "@/lib/portail-atelier";

export const dynamic = "force-dynamic";

/**
 * Le hall des ateliers.
 *
 * Une seule question à l'écran : « où travaillez-vous ? ». Les ateliers
 * sont rangés par USINE, parce que c'est la séparation qui compte —
 * ADMEDCO fabrique le dur, MOBILIX la chaise tapissée, et les deux ne
 * se mélangent jamais.
 *
 * ── Un ouvrier, un atelier ──
 * Un WORKER affecté à un atelier ne passe PAS par ce hall : il est
 * ouvert directement sur son poste — c'est ce qu'il vient chercher.
 * Ce hall existe pour trois cas seulement :
 *
 *   · il n'est affecté à rien (l'admin doit le placer) ;
 *   · il est administrateur et navigue entre les ateliers ;
 *   · il est magasinier, et on l'oriente vers la Réception MP.
 *
 * Le sélecteur du bandeau d'atelier lui rend malgré tout la liste
 * complète visible : il voit l'organisation de l'usine sans pouvoir
 * entrer ailleurs.
 */
export default async function PageAteliers() {
  const profil = await getProfil();
  if (!profil.email) redirect("/portail");

  const mien = profil.role === "WORKER" ? profil.atelier_id : null;
  const estAdmin = profil.role === "ADMIN";

  // Un seul atelier accessible → on ne fait pas choisir : on ouvre.
  // Sauf pour l'admin, qui vient justement pour naviguer.
  if (!estAdmin && profil.role === "WORKER" && mien && slugAtelier(mien)) {
    redirect(urlAtelier(mien));
  }

  if (profil.role === "MAGASINIER") {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f5f6f2] p-6">
        <div className="w-full max-w-lg rounded-3xl border border-black/[0.05] bg-white p-7 shadow-sm">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-600">
            <ShieldAlert size={26} />
          </div>
          <h1 className="mt-4 text-[20px] font-extrabold tracking-tight text-[#1a1d23]">
            Vous êtes magasinier
          </h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-[#7c8091]">
            Votre espace est la <b>Réception matière première</b> : c'est là que vous réceptionnez, rangez et
            contrôlez ce qui entre en stock. Les portails d'atelier sont réservés aux postes de production.
          </p>
          <Link
            href="/admin/reception"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#4a7c59] px-4 py-3 text-[13px] font-black text-white"
          >
            Aller à la Réception MP <ChevronRight size={15} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f6f2] text-[#1a1d23]">
      <div className="mx-auto max-w-[1000px] px-4 py-8 sm:px-6 sm:py-12">
        {/* ── En-tête ── */}
        <header className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#9ca3af]">
                ADMEDCO MES · Portails d'atelier
              </p>
              <h1 className="mt-2 text-[30px] font-black leading-tight tracking-tight sm:text-[36px]">
                Où travaillez-vous&nbsp;?
              </h1>
              <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-[#7c8091]">
                Chaque atelier a son portail : ses postes, sa file de travail, ses déclarations. Connectez-vous
                sur le vôtre pour démarrer la journée.
              </p>
            </div>
            <Link
              href="/logout"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-black/[0.06] bg-white text-[#6b7280] shadow-sm transition-colors hover:text-[#c24a08]"
              title="Se déconnecter"
            >
              <LogOut size={17} />
            </Link>
          </div>

          {/* Un ouvrier sans atelier : c'est une donnée manquante, pas
              une erreur de sa part. On le dit et on indique qui répare. */}
          {profil.role === "WORKER" && !mien && (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-800">
              <b>Votre compte n'est rattaché à aucun atelier.</b> Vous pouvez consulter les portails, mais vous
              ne pourrez y déclarer de travail. Demandez à l'administrateur de vous affecter un poste depuis{" "}
              <span className="font-mono">/admin/team</span>.
            </div>
          )}

          {/* Qui est connecté, et sur quoi */}
          <div className="mt-5 inline-flex flex-wrap items-center gap-3 rounded-2xl border border-black/[0.05] bg-white px-4 py-2.5 shadow-sm">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#4a7c59] text-[13px] font-black text-white">
              {(profil.full_name ?? profil.email ?? "?").trim().charAt(0).toUpperCase()}
            </span>
            <div className="leading-tight">
              <p className="text-[13px] font-bold">{profil.full_name ?? profil.email}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af]">
                {estAdmin ? "Administrateur — accès à tous les ateliers" : `Usine ${profil.usine_code}`}
              </p>
            </div>
          </div>
        </header>

        {/* ── Les usines ── */}
        {USINES_AFFICHEES.map((u) => (
          <section key={u.code} className="mb-9">
            <div className="mb-3 flex items-baseline gap-3">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: u.accent }} />
              <h2 className="text-[19px] font-black tracking-tight" style={{ color: u.accent }}>
                {u.nom}
              </h2>
              <span className="text-[12.5px] text-[#9ca3af]">{u.sousTitre}</span>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {fichesParUsine(u.code).map((f) => (
                <CarteAtelier key={f.slug} fiche={f} estLeMien={mien === f.id} />
              ))}
            </div>
          </section>
        ))}

        <p className="rounded-2xl border border-black/[0.05] bg-white px-4 py-3 text-[12px] leading-relaxed text-[#9ca3af] shadow-sm">
          Un <b>WORKER</b> n'ouvre que l'atelier auquel son compte est rattaché. Pour changer quelqu'un de
          poste, l'administrateur passe par <span className="font-mono text-[#6b7280]">/admin/team</span>.
        </p>
      </div>
    </div>
  );
}

function CarteAtelier({ fiche, estLeMien }: { fiche: FicheAtelier; estLeMien: boolean }) {
  // La gamme RÉELLE de l'atelier, pas un résumé : l'ouvrier doit
  // pouvoir vérifier que c'est bien son poste avant d'entrer. Les
  // noms viennent de `fiche.gammes`, déjà résolu par `portail-atelier`
  // (ETAPES_A1_GAMME pour A1, la gamme MOBILIX pour M1/M2…).
  const apercu = fiche.gammes.map((e) => e.nom);

  return (
    <Link
      href={urlAtelier(fiche.id)}
      className="group flex flex-col rounded-3xl border bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{ borderColor: estLeMien ? `${fiche.accent}55` : "rgba(0,0,0,.05)" }}
    >
      <div className="flex items-start gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-[22px]" style={{ background: `${fiche.accent}12` }}>
          {fiche.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: fiche.accent }}>
            {fiche.code} · {fiche.usine}
          </p>
          <p className="mt-0.5 text-[17px] font-extrabold leading-tight tracking-tight text-[#1a1d23]">
            {fiche.court}
          </p>
        </div>
        {estLeMien && (
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-[9.5px] font-black uppercase tracking-wider text-white"
            style={{ background: fiche.accent }}
          >
            Le vôtre
          </span>
        )}
      </div>

      <p className="mt-3 text-[12.5px] leading-relaxed text-[#7c8091]">{fiche.role}</p>

      {/* L'aperçu des postes : la vraie preuve d'identité de l'atelier. */}
      <div className="mt-3.5 flex flex-wrap gap-1.5">
        {apercu.slice(0, 5).map((nom, i) => (
          <span
            key={`${nom}-${i}`}
            className="rounded-lg px-2 py-1 text-[10.5px] font-semibold"
            style={{ background: `${fiche.accent}0d`, color: fiche.accent }}
          >
            {i + 1}. {nom}
          </span>
        ))}
        {apercu.length > 5 && (
          <span className="rounded-lg bg-black/[0.04] px-2 py-1 text-[10.5px] font-semibold text-[#9ca3af]">
            +{apercu.length - 5}
          </span>
        )}
      </div>

      <p
        className="mt-4 inline-flex items-center gap-1 text-[13px] font-black transition-transform group-hover:translate-x-0.5"
        style={{ color: fiche.accent }}
      >
        {estLeMien ? "Ouvrir mon poste" : "Ouvrir ce portail"} <ChevronRight size={15} />
      </p>
    </Link>
  );
}
