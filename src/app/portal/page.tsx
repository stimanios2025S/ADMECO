import PortalClient from "./PortalClient";
import Atelier1Tools from "./Atelier1Tools";
import Atelier2Tools from "./Atelier2Tools";

export const dynamic = "force-dynamic";

export default function PortalPage({
  searchParams,
}: {
  searchParams?: { mode?: string; atelier?: string };
}) {
  const mode = searchParams?.mode === "warehouse" ? "warehouse" : "factory";
  const atelierParam = searchParams?.atelier === "1" ? 1 : searchParams?.atelier === "2" ? 2 : null;

  const panel =
    atelierParam === 1
      ? {
          label: "Portail atelier",
          title: "ADMEDCO Atelier 1",
          accent: "text-fire",
          slogan: "Bois & Découpe — découpe, usinage, préparation"
        }
      : atelierParam === 2
        ? {
            label: "Portail atelier",
            title: "ADMEDCO Atelier 2",
            accent: "text-emerald-300",
            slogan: "Assemblage & Finition — soudage, poudrage, montage"
          }
        : mode === "warehouse"
          ? {
              label: "Portail atelier",
              title: "ADMEDCO Magasin",
              accent: "text-emerald-300",
              slogan: "Flux de stock & expédition"
            }
          : {
              label: "Portail atelier",
              title: "ADMEDCO Ateliers",
              accent: "text-fire",
              slogan: "Ligne de production & contrôle des étapes"
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
        </header>

        {!atelierParam && (
          <div className="mb-6 grid gap-3 sm:grid-cols-2">
            <a href="/portal?atelier=1" className="glass rounded-2xl p-5 transition hover:border-orange-400/40">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Atelier 1</p>
              <p className="mt-2 text-xl font-black tracking-tight text-white">Bois &amp; Découpe</p>
              <p className="mt-1 text-sm text-zinc-400">Découpe, usinage, préparation — scanner les QR, démarrer et terminer les étapes.</p>
              <p className="mt-3 text-sm font-bold text-orange-300">Ouvrir le portail →</p>
            </a>
            <a href="/portal?atelier=2" className="glass rounded-2xl p-5 transition hover:border-emerald-400/40">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Atelier 2</p>
              <p className="mt-2 text-xl font-black tracking-tight text-white">Assemblage &amp; Finition</p>
              <p className="mt-1 text-sm text-zinc-400">Assemblage, soudage, poudrage, montage — réception Atelier 1, finition, bordereaux.</p>
              <p className="mt-3 text-sm font-bold text-emerald-300">Ouvrir le portail →</p>
            </a>
          </div>
        )}

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {[
            { label: mode === "warehouse" ? "Unités en stock" : "Commandes actives", value: mode === "warehouse" ? "84" : "18", accent: "fire" },
            { label: mode === "warehouse" ? "Prêt à expédier" : "Taux de production", value: mode === "warehouse" ? "96%" : "96%", accent: "ice" },
            { label: "Alertes", value: mode === "warehouse" ? "03" : "02", accent: "green" }
          ].map((stat) => (
            <div key={stat.label} className="glass rounded-2xl p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">{stat.label}</p>
              <p className="mt-3 text-3xl font-black tracking-tight text-white">{stat.value}</p>
            </div>
          ))}
        </div>

        {atelierParam === 1 && (
          <div className="mb-6">
            <Atelier1Tools />
          </div>
        )}
        {atelierParam === 2 && (
          <div className="mb-6">
            <Atelier2Tools />
          </div>
        )}

        <PortalClient mode={mode} atelierId={atelierParam} />
      </div>
    </div>
  );
}
