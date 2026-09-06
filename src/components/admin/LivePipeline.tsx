"use client";
import { isOverdue, scrapPct } from "@/lib/calc/yield";

export type Step = {
  id: string; step_order: number; step_name: string; atelier_id: number;
  status: string; estimated_minutes: number; actual_minutes: number;
  good_units: number; scrap_units: number; expected_units: number;
  started_at: string | null; worker_id: string | null;
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: "bg-zinc-700", ACTIVE: "bg-blue-600 animate-pulse",
  PAUSED: "bg-amber-600", DONE: "bg-emerald-600",
  REWORK: "bg-red-600", SKIPPED_SPLIT: "bg-purple-600"
};

export default function LivePipeline({ steps }: { steps: Step[] }) {
  const sorted = [...steps].sort((a, b) => a.step_order - b.step_order);
  return (
    <div className="space-y-2">
      {sorted.map((s) => {
        const sp = scrapPct(s.good_units, s.scrap_units);
        const overdue = isOverdue(Number(s.actual_minutes), s.estimated_minutes);
        return (
          <div key={s.id} className="flex items-center gap-3 rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-white">
            <span className={`rounded-lg px-2 py-1 text-xs font-black ${STATUS_COLOR[s.status] ?? "bg-zinc-700"}`}>{s.status}</span>
            <div className="flex-1 min-w-0">
              <div className="font-bold truncate">#{s.step_order} {s.step_name}</div>
              <div className="text-xs text-zinc-400">
                Atelier {s.atelier_id} · {Number(s.actual_minutes).toFixed(0)}/{s.estimated_minutes} min · Good {s.good_units}/{s.expected_units}
              </div>
            </div>
            {overdue && s.status !== "PENDING" && (
              <span className="rounded-lg bg-red-600 px-2 py-1 text-xs font-black">🔴 +{(Number(s.actual_minutes) - s.estimated_minutes).toFixed(0)} min</span>
            )}
            {sp > 5 && (
              <span className="rounded-lg bg-orange-500 px-2 py-1 text-xs font-black text-black">⚠️ {sp.toFixed(1)}% scrap</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
