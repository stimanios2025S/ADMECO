"use client";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function GlassCard({ className, children, style }: { className?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <section className={cn("glass animate-fade-up p-5", className)} style={style}>
      {children}
    </section>
  );
}

export function SectionTitle({ kicker, title, hint, right }: { kicker?: string; title: string; hint?: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        {kicker && (
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">{kicker}</p>
        )}
        <h2 className="text-xl font-extrabold tracking-tight text-white">{title}</h2>
        {hint && <p className="mt-0.5 text-sm text-zinc-400">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

export function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "fire" | "ice" | "green" | "red" }) {
  const ring =
    accent === "fire" ? "border-fire/30" :
    accent === "ice" ? "border-ice/30" :
    accent === "green" ? "border-emerald-400/30" :
    accent === "red" ? "border-red-400/30" : "";
  const glow =
    accent === "fire" ? "text-fire" :
    accent === "ice" ? "text-ice" :
    accent === "green" ? "text-emerald-300" :
    accent === "red" ? "text-red-300" : "text-white";
  return (
    <div className={cn("glass-soft p-4", ring)}>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className={cn("mt-1 text-3xl font-black tracking-tight", glow)}>{value}</p>
      {sub && <p className="mt-1 text-xs text-zinc-400">{sub}</p>}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    DONE: "bg-emerald-400/15 text-emerald-300 border-emerald-400/30",
    ACTIVE: "bg-ice/15 text-ice-soft border-ice/30",
    PENDING: "bg-zinc-400/10 text-zinc-300 border-white/10",
    PAUSED: "bg-amber-400/15 text-amber-300 border-amber-400/30",
    REWORK: "bg-red-400/15 text-red-300 border-red-400/30",
    VERIFIED: "bg-emerald-400/15 text-emerald-300 border-emerald-400/30",
    IN_TRANSIT: "bg-amber-400/15 text-amber-300 border-amber-400/30",
    SHORTAGE: "bg-red-400/15 text-red-300 border-red-400/30",
    IN_PROGRESS: "bg-ice/15 text-ice-soft border-ice/30",
    COMPLETED: "bg-emerald-400/15 text-emerald-300 border-emerald-400/30",
    CREATED: "bg-zinc-400/10 text-zinc-300 border-white/10",
    ADMIN: "bg-fire/15 text-fire-soft border-fire/30",
    WORKER: "bg-ice/15 text-ice-soft border-ice/30"
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold", map[status] ?? "bg-zinc-400/10 text-zinc-300 border-white/10")}>
      {status}
    </span>
  );
}

export function Empty({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div className="glass-soft flex flex-col items-center gap-1 px-6 py-10 text-center">
      <div className="text-4xl">{icon}</div>
      <p className="font-bold text-zinc-200">{title}</p>
      {hint && <p className="text-sm text-zinc-500">{hint}</p>}
    </div>
  );
}
