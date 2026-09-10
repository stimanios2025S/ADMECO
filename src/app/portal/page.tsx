import PortalClient from "./PortalClient";
import Atelier1Tools from "./Atelier1Tools";
import Atelier2Tools from "./Atelier2Tools";
import EtapePortail from "./EtapePortail";

export const dynamic = "force-dynamic";

// Portail : /portal → choix atelier → /portal?atelier=1 → choix étape → /portal?atelier=1&etape=2
// Chaque étape a son portail dédié, poste verrouillé sur l'étape.
export default function PortalPage({
  searchParams,
}: {
  searchParams?: { mode?: string; atelier?: string; etape?: string };
}) {
  const mode = searchParams?.mode === "warehouse" ? "warehouse" : "factory";
  const atelierParam = searchParams?.atelier === "1" ? 1 : searchParams?.atelier === "2" ? 2 : null;
  const etapeParam = searchParams?.etape ? Number(searchParams.etape) : null;
  const etape = etapeParam && etapeParam >= 1 && etapeParam <= 30 ? etapeParam : null;

  const panel =
    atelierParam === 1
      ? {
          label: etape ? `Portail atelier 1 — Étape ${etape}` : "Portail atelier 1",
          title: "ADMEDCO Atelier 1",
          accent: "text-fire",
          slogan: "Bois & Découpe — alimenté par DEP-MP, produit vers Stock A1"
        }
      : atelierParam === 2
        ? {
            label: etape ? `Portail atelier 2 — Étape ${etape}` : "Portail atelier 2",
            title: "ADMEDCO Atelier 2",
            accent: "text-emerald-300",
            slogan: "Assemblage & Finition — réceptionne A1, alimenté par DEP-MP, produit vers Stock A2"
          }
        : mode === "warehouse"
          ? {
              label: "Portail atelier",
              title: "ADMEDCO Magasin",
              accent: "text-emerald-300",
              slogan: "DEP-MP centrale & expédition"
            }
          : {
              label: "Portail atelier",
              title: "ADMEDCO Ateliers",
              accent: "text-fire",
              slogan: "Choisissez votre atelier puis votre étape"
            };

  return (
    <div className="bg-mesh min-h-screen text-zinc-100">
      <div className="bg-grid-faint pointer-events-none fixed inset-0" />
      <div className="relative mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="premium-card mb-6 overflow-hidden rounded-[28px] p-5 sm:p-6">
          <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-zinc-400">{panel.label}</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.05em] sm:text-4xl">
                {panel.title.split(" ")[0]} <span className={panel.accent}>{panel.title.split(" ").slice(1).join(" ")}</span>
              </h1>
            </div>

            <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.18em] text-zinc-300">
              <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-emerald-300">Ligne en direct</span>
              <span className="rounded-full border border-ice/30 bg-ice/10 px-3 py-1.5 text-ice-soft">{panel.slogan}</span>
            </div>
          </div>
          {(atelierParam || etape) && (
            <nav className="relative z-10 mt-4 flex flex-wrap items-center gap-1.5 text-xs font-bold text-zinc-400">
              <a href="/portal" className="rounded-lg bg-white/5 px-2.5 py-1 hover:text-white">Ateliers</a>
              {atelierParam && (
                <>
                  <span>/</span>
                  <a href={`/portal?atelier=${atelierParam}`} className="rounded-lg bg-white/5 px-2.5 py-1 hover:text-white">
                    Atelier {atelierParam}
                  </a>
                </>
              )}
              {etape && (
                <>
                  <span>/</span>
                  <span className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-emerald-200">Étape {etape}</span>
                </>
              )}
            </nav>
          )}
        </header>

        {!atelierParam && (
          <div className="mb-6 grid gap-3 sm:grid-cols-2">
            <a href="/portal?atelier=1" className="glass rounded-2xl p-5 transition hover:border-orange-400/40">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Atelier 1 · 5 étapes</p>
              <p className="mt-2 text-xl font-black tracking-tight text-white">🪚 Bois &amp; Découpe</p>
              <p className="mt-1 text-sm text-zinc-400">Arrivée MP → Découpe → Usinage → Préparation → Contrôle + Stock A1. Chaque étape a son portail.</p>
              <p className="mt-3 text-sm font-bold text-orange-300">Choisir mon étape →</p>
            </a>
            <a href="/portal?atelier=2" className="glass rounded-2xl p-5 transition hover:border-emerald-400/40">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Atelier 2 · 6 étapes</p>
              <p className="mt-2 text-xl font-black tracking-tight text-white">🔧 Assemblage &amp; Finition</p>
              <p className="mt-1 text-sm text-zinc-400">Réception A1 → Assemblage → Soudage → Poudrage → Montage → Contrôle + Stock A2.</p>
              <p className="mt-3 text-sm font-bold text-emerald-300">Choisir mon étape →</p>
            </a>
          </div>
        )}

        {atelierParam && !etape && (
          <div className="mb-6">
            <EtapePortail atelier={atelierParam} etapeActive={null} />
          </div>
        )}

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

        {(etape || !atelierParam) && <PortalClient mode={mode} atelierId={atelierParam} etape={etape} />}
        {atelierParam && !etape && (
          <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-bold text-zinc-300">
            👆 Sélectionnez votre étape ci-dessus pour ouvrir son portail et scanner les QR.
          </p>
        )}
      </div>
    </div>
  );
}
