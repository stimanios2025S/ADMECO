"use client";
import { scrapPct, isOverdue } from "@/lib/calc/yield";
import { StatusPill } from "./ui";

export type Step = {
  id: string; step_order: number; step_name: string; atelier_id: number;
  status: string; estimated_minutes: number; actual_minutes: number;
  good_units: number; scrap_units: number; expected_units: number;
  started_at: string | null; worker_id: string | null;
};

const DOT: Record<string, string> = {
  PENDING: "bg-zinc-500", ACTIVE: "bg-ice", PAUSED: "bg-amber-400",
  DONE: "bg-emerald-400", REWORK: "bg-red-400", SKIPPED_SPLIT: "bg-purple-400"
};

export default function LivePipeline({ steps }: { steps: Step[] }) {
  const sorted = [...steps].sort((a, b) => a.step_order - b.step_order);
  if (sorted.length === 0) return <p className="text-sm text-zinc-500">No steps in this view.</p>;
  return (
    <div className="max-h-[520px] space-y-1.5 overflow-y-auto pr-1">
      {sorted.map((s) => {
        const sp = scrapPct(s.good_units ?? 0, s.scrap_units ?? 0);
        const overdue = isOverdue(Number(s.actual_minutes), s.estimated_minutes) && s.status !== "PENDING";
        return (
          <div key={s.id} className="glass-soft flex items-center gap-3 p-2.5">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[s.status] ?? "bg-zinc-500"} ${s.status === "ACTIVE" ? "live-dot" : ""}`} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">#{s.step_order} {s.step_name}</p>
              <p className="truncate text-[11px] text-zinc-500">
                A{s.atelier_id} · {Number(s.actual_minutes).toFixed(0)}/{s.estimated_minutes} min · Good {s.good_units}/{s.expected_units}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {overdue && (
                <span className="rounded-md bg-red-500/20 border border-red-400/30 px-1.5 py-0.5 text-[10px] font-black text-red-300">
                  +{(Number(s.actual_minutes) - s.estimated_minutes).toFixed(0)}m
                </span>
              )}
              {sp > 5 && (
                <span className="rounded-md bg-fire/20 border border-fire/30 px-1.5 py-0.5 text-[10px] font-black text-fire-soft">
                  {sp.toFixed(0)}% scrap
                </span>
              )}
              <StatusPill status={s.status} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
