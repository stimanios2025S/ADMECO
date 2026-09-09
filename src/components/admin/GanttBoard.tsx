"use client";
import type { Step } from "./LivePipeline";

export default function GanttBoard({ steps }: { steps: Step[] }) {
  const sorted = [...steps].sort((a, b) => a.step_order - b.step_order);
  if (sorted.length === 0) return <p className="text-sm text-[#7c8091]">Aucune étape dans cette vue.</p>;
  const maxEst = Math.max(1, ...sorted.map((s) => s.estimated_minutes));
  return (
    <div className="max-h-[520px] space-y-1.5 overflow-y-auto pr-1">
      {sorted.map((s) => {
        const actual = Number(s.actual_minutes) || (s.status === "ACTIVE" ? s.estimated_minutes * 0.5 : 0);
        const bad = actual > s.estimated_minutes;
        return (
          <div key={s.id} className="grid grid-cols-[150px_1fr] items-center gap-2 text-xs">
            <div className="truncate text-[#1a1d23] font-medium">#{s.step_order} {s.step_name}</div>
            <div className="relative h-6 overflow-hidden rounded-lg bg-[#f0ede8]">
              <div className="absolute inset-y-0 left-0 rounded-lg bg-[#c7c5c0]/40" style={{ width: `${Math.min(100, (s.estimated_minutes / maxEst) * 100)}%` }} />
              <div className={`absolute inset-y-0 left-0 rounded-lg ${bad ? "bg-gradient-to-r from-red-500 to-[#c24a08]" : "bg-gradient-to-r from-[#2f6eb5] to-[#6fa67d]"}`}
                style={{ width: `${Math.min(100, (actual / maxEst) * 100)}%`, opacity: 0.9 }} />
              <span className="absolute inset-0 flex items-center px-2 font-mono text-[10px] font-bold text-white">
                {actual.toFixed(0)}/{s.estimated_minutes}m
              </span>
            </div>
          </div>
        );
      })}
      <p className="pt-1 text-[11px] text-[#7c8091]">Clair = cible · Bleu = dans les temps · Rouge-orange = en retard</p>
    </div>
  );
}
