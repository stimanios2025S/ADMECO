import { Suspense } from "react";
import PortalClient from "./PortalClient";
import Atelier1Tools from "./Atelier1Tools";
import Atelier2Tools from "./Atelier2Tools";
import Atelier3Tools from "./Atelier3Tools";
import MobilixTools from "./MobilixTools";
import EtapePortail from "./EtapePortail";
import PortalSync from "./PortalSync";
import PortailSimple from "./PortailSimple";
import type { AtelierId } from "@/lib/ateliers";
import { ETAPES_A1_GAMME } from "@/lib/process-eco";
import { ETAPES_A3 } from "@/lib/etapes";

export const dynamic = "force-dynamic";

export default function PortalPage({
  searchParams,
}: {
  searchParams?: { mode?: string; atelier?: string; etape?: string };
}) {
  const mode = searchParams?.mode === "warehouse" ? "warehouse" : "factory";
  const atelierParam: AtelierId | null =
    searchParams?.atelier === "1" ? 1
    : searchParams?.atelier === "2" ? 2
    : searchParams?.atelier === "3" ? 3
    : searchParams?.atelier === "4" ? 4
    : null;
  const etapeParam = searchParams?.etape ? Number(searchParams.etape) : null;
  const etape = etapeParam && etapeParam >= 1 && etapeParam <= 30 ? etapeParam : null;
  const DERNIERE_ETAPE_A1 = ETAPES_A1_GAMME.length; // 6 postes + transfert A3
  const estEco = atelierParam === 1 && etape !== null && etape >= 1 && etape <= DERNIERE_ETAPE_A1;

  const panel =
    atelierParam === 1
      ? {
          label: etape ? `Atelier 1 — Étape ${etape}` : "Portail Atelier 1",
          title: "Atelier 1",
          accent: "text-[#c24a08]",
          bg: "bg-[#c24a08]",
          bgSoft: "bg-[#c24a08]/[0.06]",
          border: "border-[#c24a08]/20",
          slogan: "Gamme Tôle — Coupe → Perçage → Soudage → Contrôle → Transfert vers l'Atelier 3 (poudrage)",
        }
      : atelierParam === 2
        ? {
            label: etape ? `Atelier 2 — Étape ${etape}` : "Portail Atelier 2",
            title: "Atelier 2",
            accent: "text-[#2f6eb5]",
            bg: "bg-[#2f6eb5]",
            bgSoft: "bg-[#2f6eb5]/[0.06]",
            border: "border-[#2f6eb5]/20",
            slogan: "Montage sur pièces poudrées — A3 (poudrage) → A2 (montage) → A3 (emballage)",
          }
        : atelierParam === 4
          ? {
              label: etape ? `Atelier 3 — Étape ${etape}` : "Portail Atelier 3",
              title: "Atelier 3",
              accent: "text-[#0f766e]",
              bg: "bg-[#0f766e]",
              bgSoft: "bg-[#0f766e]/[0.06]",
              border: "border-[#0f766e]/20",
              slogan: "Poudrage & Emballage en 2 passes — reçoit l'Atelier 1 et l'Atelier 2",
            }
        : atelierParam === 3
          ? {
              label: etape ? `Atelier MOBILIX — Étape ${etape}` : "Portail Atelier MOBILIX",
              title: "Atelier MOBILIX",
              accent: "text-[#7c3aed]",
              bg: "bg-[#7c3aed]",
              bgSoft: "bg-[#7c3aed]/[0.06]",
              border: "border-[#7c3aed]/20",
              slogan: "G21 & Canada — 12 postes · 19 QR par chaise",
            }
        : {
            label: "Portail ateliers",
            title: "ADMEDCO Ateliers",
            accent: "text-[#4a7c59]",
            bg: "bg-[#4a7c59]",
            bgSoft: "bg-[#4a7c59]/[0.06]",
            border: "border-[#4a7c59]/20",
            slogan: "Choisissez votre atelier puis votre étape",
          };

  return (
    <div className="min-h-screen bg-[#f5f6f2] text-[#1a1d23]">
      {/* Portail libre : prénom + atelier + étape, sans mot de passe */}
      {/* Socle synchronisation : file hors-ligne + temps réel + bouton Synchroniser */}
      <Suspense fallback={null}>
        <PortalSync />
      </Suspense>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-6 rounded-2xl border border-black/[0.04] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#9ca3af]">{panel.label}</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-[#1a1d23] sm:text-4xl">
                {panel.title} <span className={panel.accent}>Portail</span>
              </h1>
              <p className="mt-1 text-sm text-[#6b7280]">{panel.slogan}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#4a7c59]/20 bg-[#4a7c59]/[0.06] px-3 py-1.5 text-[11px] font-bold text-[#4a7c59]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#4a7c59] live-dot" />
                Ligne en direct
              </span>
            </div>
          </div>

          {/* Breadcrumb */}
          {(atelierParam || etape) && (
            <nav className="mt-4 flex flex-wrap items-center gap-1.5 text-xs font-bold text-[#9ca3af]">
              <a href="/portal" className="rounded-lg bg-black/[0.03] px-2.5 py-1 hover:text-[#1a1d23] transition-colors">Ateliers</a>
              {atelierParam && (
                <>
                  <span>/</span>
                  <a href={`/portal?atelier=${atelierParam}`} className="rounded-lg bg-black/[0.03] px-2.5 py-1 hover:text-[#1a1d23] transition-colors">
                    Atelier {atelierParam}
                  </a>
                </>
              )}
              {etape && (
                <>
                  <span>/</span>
                  <span className={`rounded-lg ${panel.bgSoft} px-2.5 py-1 ${panel.accent}`}>Étape {etape}</span>
                </>
              )}
            </nav>
          )}
        </header>

        {/* Atelier chooser — no atelier selected */}
        {!atelierParam && (
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <a href="/portal?atelier=1" className="group rounded-2xl border border-[#c24a08]/10 bg-white p-6 shadow-sm transition hover:shadow-md hover:border-[#c24a08]/30">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#9ca3af]">Atelier 1 · ADMEDCO</p>
              <p className="mt-3 text-2xl font-black tracking-tight text-[#1a1d23]">🪚 Tôle &amp; Gros œuvre</p>
              <p className="mt-2 text-sm text-[#6b7280]">Les pièces lourdes et la tôle : coupe, perçage, soudage. Puis transfert vers l&apos;Atelier 3.</p>
              <p className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[#c24a08] group-hover:translate-x-0.5 transition-transform">
                Choisir mon étape <span className="text-lg">→</span>
              </p>
            </a>
            <a href="/portal?atelier=2" className="group rounded-2xl border border-[#2f6eb5]/10 bg-white p-6 shadow-sm transition hover:shadow-md hover:border-[#2f6eb5]/30">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#9ca3af]">Atelier 2 · ADMEDCO</p>
              <p className="mt-3 text-2xl font-black tracking-tight text-[#1a1d23]">🔧 Bureau</p>
              <p className="mt-2 text-sm text-[#6b7280]">Reçoit les pièces <em>déjà poudrées</em> par l&apos;Atelier 3, monte le mobilier de bureau, puis renvoie à l&apos;Atelier 3 pour l&apos;emballage.</p>
              <p className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[#2f6eb5] group-hover:translate-x-0.5 transition-transform">
                Choisir mon étape <span className="text-lg">→</span>
              </p>
            </a>
            <a href="/portal?atelier=4" className="group rounded-2xl border border-[#0f766e]/10 bg-white p-6 shadow-sm transition hover:shadow-md hover:border-[#0f766e]/30">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#9ca3af]">Atelier 3 · ADMEDCO · {ETAPES_A3.length} étapes</p>
              <p className="mt-3 text-2xl font-black tracking-tight text-[#1a1d23]">🎨 Poudrage &amp; Emballage</p>
              <p className="mt-2 text-sm text-[#6b7280]">
                Travaille pour l&apos;Atelier 1 <em>et</em> l&apos;Atelier 2, en 2 passes : phase 1 poudrage des pièces brutes,
                phase 2 emballage du produit monté → stock produit fini.
              </p>
              <p className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[#0f766e] group-hover:translate-x-0.5 transition-transform">
                Choisir mon étape <span className="text-lg">→</span>
              </p>
            </a>
            <a href="/portal?atelier=3" className="group rounded-2xl border border-[#7c3aed]/10 bg-white p-6 shadow-sm transition hover:shadow-md hover:border-[#7c3aed]/30">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#9ca3af]">Atelier MOBILIX · 12 postes · 19 QR</p>
              <p className="mt-3 text-2xl font-black tracking-tight text-[#1a1d23]">📦 G21 &amp; Canada</p>
              <p className="mt-2 text-sm text-[#6b7280]">Coupe → Traçage → Couture A→H → Contrôle → Bois → Inserts → Rembourrage → Piètement → Assemblage → Emballage.</p>
              <p className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[#7c3aed] group-hover:translate-x-0.5 transition-transform">
                Choisir mon étape <span className="text-lg">→</span>
              </p>
            </a>
          </div>
        )}

        {/* Mon poste (prénom + atelier + étape, sans mot de passe) */}
        <PortailSimple atelierDemande={atelierParam} etapeDemande={etape} />

        {/* Step chooser — atelier selected, no step */}
        {atelierParam && !etape && (
          <div className="mb-6">
            <EtapePortail atelier={atelierParam} etapeActive={null} />
          </div>
        )}

        {/* Atelier tools — step selected */}
        {atelierParam === 1 && etape && (
          <div className="mb-6">
            <Atelier1Tools etape={etape} />
          </div>
        )}
        {atelierParam === 2 && etape && (
          <div className="mb-6">
            <Atelier2Tools etape={etape} />
          </div>
        )}
        {atelierParam === 4 && etape && (
          <div className="mb-6">
            <Atelier3Tools etape={etape} />
          </div>
        )}
        {atelierParam === 3 && etape && (
          <div className="mb-6">
            <MobilixTools etape={etape} />
          </div>
        )}

        {/* QR Scanner & Kiosk */}
        {(etape || !atelierParam) && <PortalClient mode={mode} atelierId={atelierParam} etape={etape} />}

        {atelierParam && !etape && (
          <div className="rounded-2xl border border-black/[0.04] bg-white p-4 text-center text-sm font-bold text-[#6b7280] shadow-sm">
            👆 Sélectionnez votre étape ci-dessus pour ouvrir son portail et scanner les QR.
          </div>
        )}
      </div>
    </div>
  );
}
