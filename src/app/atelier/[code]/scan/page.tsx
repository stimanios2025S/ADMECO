import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, QrCode } from "lucide-react";
import PortalClient from "./PortalClient";
import Atelier1Tools from "./Atelier1Tools";
import Atelier2Tools from "./Atelier2Tools";
import Atelier3Tools from "./Atelier3Tools";
import MobilixTools from "./MobilixTools";
import PortalSync from "./PortalSync";
import { getProfil } from "@/lib/auth";
import { verifierAccesAtelier } from "@/app/actions-atelier";
import { atelierDuSlug, ficheAtelier, urlAtelier } from "@/lib/portail-atelier";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ═══════════════════════════════════════════════════════════
// /atelier/<code>/scan — LE SCAN DES QR D'UN ATELIER
//
// ── Pourquoi c'est ICI et plus sur /portal ──
// Le scan vivait sur `/portal`, à côté de `/portail` : deux adresses
// qui ne différaient que d'une lettre, l'une pour se connecter, l'autre
// pour scanner. Personne ne pouvait s'y retrouver — et l'ouvrier devait
// redire à la main quel atelier il venait d'ouvrir.
//
// Le scan est maintenant un ÉTAGE de l'atelier. L'URL porte l'atelier
// une fois pour toutes :
//
//   /portail/a1              on entre          (public)
//   /atelier/a1              on travaille      (la file)
//   /atelier/a1/scan?etape=3 on scanne         (cette page)
//
// L'atelier n'est plus un paramètre qu'on peut falsifier : il est dans
// le chemin, et `verifierAccesAtelier` le confronte au profil.
//
// ── Un seul point d'autorisation ──
// Le slug autorise la page, PAS les écritures : chaque déclaration
// repasse par `actions-atelier`, qui revérifie `atelier_id` en base.
// Cette page ne fait que décider ce qu'on AFFICHE.
// ═══════════════════════════════════════════════════════════

export default async function PageScanAtelier({
  params,
  searchParams,
}: {
  params: { code: string };
  searchParams?: { mode?: string; etape?: string };
}) {
  const slug = (params?.code ?? "").trim().toLowerCase();
  const id = atelierDuSlug(slug);
  const fiche = ficheAtelier(id);

  // Slug inconnu : on rend la main au choix de l'usine, seul écran
  // qui sait expliquer qu'un atelier n'existe pas.
  if (!fiche || !id) redirect("/portail");

  // Un QR de poste collé au mur mène ici. Sans session, on ouvre
  // l'atelier du QR plutôt que de réclamer un mot de passe : c'est
  // tout l'intérêt du scan, et l'ouvrier n'a rien à retenir.
  //
  // `suite` fait suivre le poste visé : après l'ouverture, l'ouvrier
  // revient sur LE scan qu'il demandait, pas sur le tableau. Sinon un
  // scan de QR atterrirait toujours sur l'écran d'accueil de
  // l'atelier — c'est-à-dire sur rien.
  const profil = await getProfil();
  if (!profil.email) {
    const reste = new URLSearchParams();
    if (searchParams?.mode) reste.set("mode", searchParams.mode);
    if (searchParams?.etape) reste.set("etape", searchParams.etape);
    const q = reste.toString();
    const suite = `/atelier/${slug}/scan${q ? `?${q}` : ""}`;
    redirect(`/ouvrir/${slug}?suite=${encodeURIComponent(suite)}`);
  }

  // ── Le garde-fou ──
  // Un ouvrier de l'Atelier 1 qui tape /atelier/m1/scan doit être
  // arrêté ICI, pas au moment où il déclare. La page d'atelier porte
  // déjà le message de refus ; on la lui rend telle quelle plutôt que
  // d'en écrire un second, qui finirait par diverger.
  const acces = await verifierAccesAtelier(slug);
  if (!acces.ok) redirect(urlAtelier(id));

  const mode = searchParams?.mode === "warehouse" ? "warehouse" : "factory";

  const etapeParam = searchParams?.etape ? Number(searchParams.etape) : null;
  const etape = etapeParam && etapeParam >= 1 && etapeParam <= 30 ? etapeParam : null;

  return (
    <div className="min-h-screen bg-[#f5f6f2] text-[#1a1d23]">
      <Suspense fallback={null}>
        <PortalSync />
      </Suspense>

      {/* La barre de couleur de l'atelier : le même repère que sur le
          portail, pour qu'on sache en un regard où l'on est. */}
      <div className="h-1.5 w-full" style={{ background: fiche.accent }} />

      <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6">
        <header
          className="mb-5 rounded-2xl border border-black/[0.05] bg-white p-4 shadow-sm"
          style={{ boxShadow: `inset 4px 0 0 ${fiche.accent}` }}
        >
          <div className="flex items-center gap-3">
            <Link
              href={urlAtelier(id)}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-black/[0.06] bg-black/[0.02] text-[#6b7280] transition-colors hover:text-[#1a1d23]"
              title="Retour à ma file de travail"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#9ca3af]">
                Scan des QR · {fiche.usine} · {fiche.code}
              </p>
              <h1 className="truncate text-[19px] font-extrabold tracking-tight">
                {fiche.emoji} {fiche.court}
                {etape ? (
                  <span style={{ color: fiche.accent }}> — poste {etape}</span>
                ) : (
                  <span className="text-[#b0b5bf]"> — tous les postes</span>
                )}
              </h1>
            </div>
            <span
              className="hidden shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold text-white sm:inline-flex"
              style={{ background: fiche.accent }}
            >
              <QrCode size={13} /> Scanner actif
            </span>
          </div>
          <p className="mt-3 border-t border-black/[0.04] pt-3 text-[12.5px] leading-relaxed text-[#7c8091]">
            Scannez le QR collé sur la pièce ou sur la feuille de route. Ce que vous déclarez ici est écrit
            directement dans <span className="font-mono">work_order_steps</span> — la même table que lit votre
            portail d&apos;atelier, et que lisent les quatre autres.
          </p>
        </header>

        {/* ── Les outils du poste ──
            Chaque composant interroge SON atelier et rien d'autre. Les
            deux ateliers MOBILIX partagent le même écran : ce qui
            change est `atelierId` (3 pour M1, 5 pour M2) et la gamme
            affichée. Le laisser sur « 3 » pour M2 montrerait la file
            du bois sous le titre du tapissage — c'est exactement ce
            qu'on veut éviter. */}
        {id === 1 && <Atelier1Tools etape={etape} />}
        {id === 2 && <Atelier2Tools etape={etape} />}
        {id === 4 && <Atelier3Tools etape={etape} />}
        {id === 3 && <MobilixTools atelierId={3} etape={etape} />}
        {id === 5 && <MobilixTools atelierId={5} etape={etape} />}

        {/* ── La caméra ── */}
        <PortalClient mode={mode} atelierId={id} etape={etape} />
      </div>
    </div>
  );
}
