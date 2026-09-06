"use client";
import type { Step } from "./LivePipeline";

export default function GanttBoard({ steps }: { steps: Step[] }) {
  const sorted = [...steps].sort((a, b) => a.step_order - b.step_order);
  const maxEst = Math.max(1, ...sorted.map((s) => s.estimated_minutes));
  return (
    <div className="space-y-1.5">
      {sorted.map((s) => {
        const actual = Number(s.actual_minutes) || (s.status === "ACTIVE" ? s.estimated_minutes * 0.5 : 0);
        return (
          <div key={s.id} className="grid grid-cols-[180px_1fr] gap-2 items-center text-white text-xs">
            <div className="truncate">#{s.step_order} {s.step_name}</div>
            <div className="relative h-6 rounded bg-zinc-800 overflow-hidden">
              <div className="absolute inset-y-0 left-0 bg-zinc-600" style={{ width: `${Math.min(100, (s.estimated_minutes / maxEst) * 100)}%` }} />
              <div className={`absolute inset-y-0 left-0 ${actual > s.estimated_minutes ? "bg-red-500" : "bg-emerald-500"}`}
                style={{ width: `${Math.min(100, (actual / maxEst) * 100)}%`, opacity: 0.9 }} />
              <span className="absolute inset-0 flex items-center px-2 font-mono">
                {actual.toFixed(0)}/{s.estimated_minutes}m
              </span>
            </div>
          </div>
        );
      })}
      <div className="text-[11px] text-zinc-400">Gray = target · Green = actual on-track · Red = overdue</div>
    </div>
  );
}
