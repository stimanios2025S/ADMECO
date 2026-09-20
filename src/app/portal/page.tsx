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
import type { AtelierId } from "@/lib/ateliers";
import { getProfil } from "@/lib/auth";
import { ficheAtelier, slugAtelier, urlAtelier } from "@/lib/portail-atelier";

export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════
// /portal — LE SCAN DES QR, ET RIEN D'AUTRE
//
// ── Ce que cette page était ──
// Un méga-écran qui faisait quatre métiers à la fois : choisir un
// atelier, choisir une étape, saisir son prénom sans mot de passe,
// puis scanner. L'ouvrier devait donc retrouver sa file lui-même,
// alors qu'elle est calculée depuis `work_order_steps` — c'est-à-dire
// depuis la commande que l'admin vient de créer.
//
// ── Ce qu'elle est ──
// La SEULE chose qui a vraiment besoin d'être ici : la caméra. Un
// numéro d'étape dans l'URL, et l'écran de scan de ce poste.
//
// Tout le reste vit sur `/atelier/<code>`, où la file est tirée de
// la base. Une URL sans étape n'a rien à faire sur cette page : elle
// renvoie vers le portail d'atelier, qui sait où aller.
//
// ── La règle de navigation ──
//   /portal                      → /atelier (puis l'atelier de l'ouvrier)
//   /portal?atelier=1            → /atelier/a1
//   /portal?atelier=1&etape=3    → LE SCAN (cette page)
//
// ── Le piège des ids ──
// Les ateliers sont désignés par leur `id` technique : A3 = 4, M1 = 3.
// La conversion passe par `slugAtelier` / `ficheAtelier`, jamais par un
// calcul — c'est écrit noir sur blanc dans lib/portail-atelier.ts.
// ═══════════════════════════════════════════════════════════

export default async function PortalPage({
  searchParams,
}: {
  searchParams?: { mode?: string; atelier?: string; etape?: string };
}) {
  const mode = searchParams?.mode === "warehouse" ? "warehouse" : "factory";

  const etapeParam = searchParams?.etape ? Number(searchParams.etape) : null;
  const etape = etapeParam && etapeParam >= 1 && etapeParam <= 30 ? etapeParam : null;

  // L'atelier peut venir de l'URL ou du profil connecté. L'URL gagne
  // quand elle est fournie : l'ouvrier a explicitement ouvert ce poste.
  const profil = await getProfil();
  const depuisUrl = Number(searchParams?.atelier);
  const atelierId: AtelierId | null =
    [1, 2, 3, 4, 5].includes(depuisUrl)
      ? (depuisUrl as AtelierId)
      : ((profil.atelier_id as AtelierId | null) ?? null);

  // Pas d'étape → ce n'est pas une demande de scan. On renvoie vers le
  // portail d'atelier, qui, lui, affiche la file réelle.
  if (!etape && mode !== "warehouse") {
    const slug = atelierId ? slugAtelier(atelierId) : null;
    redirect(slug ? `/atelier/${slug}` : "/atelier");
  }

  const fiche = ficheAtelier(atelierId);

  return (
    <div className="min-h-screen bg-[#f5f6f2] text-[#1a1d23]">
      <Suspense fallback={null}>
        <PortalSync />
      </Suspense>

      <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6">
        {/* ── En-tête : d'où je viens, où je retourne ──
            Un ouvrier qui scanne doit pouvoir revenir à sa file d'un
            seul geste. Le bandeau porte la couleur de son atelier. */}
        <header
          className="mb-5 rounded-2xl border border-black/[0.05] bg-white p-4 shadow-sm"
          style={fiche ? { boxShadow: `inset 4px 0 0 ${fiche.accent}` } : undefined}
        >
          <div className="flex items-center gap-3">
            <Link
              href={atelierId ? urlAtelier(atelierId) : "/atelier"}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-black/[0.06] bg-black/[0.02] text-[#6b7280] transition-colors hover:text-[#1a1d23]"
              title="Retour à ma file de travail"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#9ca3af]">
                Scan des QR {fiche ? `· ${fiche.usine} · ${fiche.code}` : ""}
              </p>
              <h1 className="truncate text-[19px] font-extrabold tracking-tight">
                {fiche ? `${fiche.emoji} ${fiche.court}` : "Poste de production"}
                {etape ? <span style={{ color: fiche?.accent }}> — étape {etape}</span> : null}
              </h1>
            </div>
            <span
              className="hidden shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold text-white sm:inline-flex"
              style={{ background: fiche?.accent ?? "#4a7c59" }}
            >
              <QrCode size={13} /> Scanner actif
            </span>
          </div>
          <p className="mt-3 border-t border-black/[0.04] pt-3 text-[12.5px] leading-relaxed text-[#7c8091]">
            Scannez le QR collé sur la pièce ou sur la feuille de route. Ce que vous déclarez ici est écrit
            directement dans <span className="font-mono">work_order_steps</span> — la même table que lit
            votre portail d&apos;atelier.
          </p>
        </header>

        {/* ── Les outils du poste ──
            Chaque composant interroge SON atelier : `MobilixTools`
            filtre sur atelier_id = 3 (M1), pas sur MOBILIX en général.
            On ne le monte donc QUE pour M1 — l'afficher pour M2 (id 5)
            montrerait la file du bois sous le titre du tapissage.
            M2 n'a pas encore d'outil dédié : le scan fonctionne, et
            sa file est sur /atelier/m2. */}
        {atelierId === 1 && <Atelier1Tools etape={etape} />}
        {atelierId === 2 && <Atelier2Tools etape={etape} />}
        {atelierId === 4 && <Atelier3Tools etape={etape} />}
        {atelierId === 3 && <MobilixTools etape={etape} />}

        {/* ── La caméra ── */}
        <PortalClient mode={mode} atelierId={atelierId} etape={etape} />
      </div>
    </div>
  );
}
