import PortalClient from "./PortalClient";

export const dynamic = "force-dynamic";

export default function PortalPage({
  searchParams,
}: {
  searchParams?: { mode?: string };
}) {
  const mode = searchParams?.mode === "warehouse" ? "warehouse" : "factory";

  const panel =
    mode === "warehouse"
      ? {
          label: "Warehouse portal",
          title: "ADMECO Warehouse",
          accent: "text-emerald-300",
          slogan: "Inventory flow & outbound dispatch"
        }
      : {
          label: "Workshop portal",
          title: "ADMECO Factory floor",
          accent: "text-fire",
          slogan: "Production line & step control"
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
              <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-emerald-300">Live line</span>
              <span className="rounded-full border border-ice/30 bg-ice/10 px-3 py-1.5 text-ice-soft">{panel.slogan}</span>
            </div>
          </div>
        </header>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {[
            { label: mode === "warehouse" ? "Inventory units" : "Active orders", value: mode === "warehouse" ? "84" : "18", accent: "fire" },
            { label: mode === "warehouse" ? "Dispatch ready" : "Production rate", value: mode === "warehouse" ? "96%" : "96%", accent: "ice" },
            { label: "Alerts", value: mode === "warehouse" ? "03" : "02", accent: "green" }
          ].map((stat) => (
            <div key={stat.label} className="glass rounded-2xl p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">{stat.label}</p>
              <p className="mt-3 text-3xl font-black tracking-tight text-white">{stat.value}</p>
            </div>
          ))}
        </div>

        <PortalClient mode={mode} />
      </div>
    </div>
  );
}
