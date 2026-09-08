"use client";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function GlassCard({ className, children, style }: { className?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <section className={cn("card animate-fade-up p-5", className)} style={style}>
      {children}
    </section>
  );
}

export function SectionTitle({ kicker, title, hint, right }: { kicker?: string; title: string; hint?: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        {kicker && <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7c8091]">{kicker}</p>}
        <h2 className="text-lg font-extrabold tracking-tight text-[#1a1d23]">{title}</h2>
        {hint && <p className="mt-0.5 text-[13px] text-[#7c8091]">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

export function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "fire" | "ice" | "green" | "red" }) {
  const accentBg =
    accent === "fire" ? "bg-[#c24a08]/8" :
    accent === "ice" ? "bg-[#2f6eb5]/8" :
    accent === "green" ? "bg-[#4a7c59]/8" :
    accent === "red" ? "bg-red-50" : "bg-[#f3f0eb]";
  const accentText =
    accent === "fire" ? "text-[#c24a08]" :
    accent === "ice" ? "text-[#2f6eb5]" :
    accent === "green" ? "text-[#4a7c59]" :
    accent === "red" ? "text-red-500" : "text-[#1a1d23]";
  return (
    <div className={cn("card p-4", accentBg)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#7c8091]">{label}</p>
      <p className={cn("mt-2 text-3xl font-black tracking-tight", accentText)}>{value}</p>
      {sub && <p className="mt-1 text-[12px] text-[#7c8091]">{sub}</p>}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    DONE: "bg-[#4a7c59]/10 text-[#4a7c59] border-[#4a7c59]/20",
    ACTIVE: "bg-[#2f6eb5]/10 text-[#2f6eb5] border-[#2f6eb5]/20",
    PENDING: "bg-[#7c8091]/10 text-[#7c8091] border-black/10",
    PAUSED: "bg-amber-50 text-amber-600 border-amber-200",
    REWORK: "bg-red-50 text-red-500 border-red-200",
    VERIFIED: "bg-[#4a7c59]/10 text-[#4a7c59] border-[#4a7c59]/20",
    IN_TRANSIT: "bg-amber-50 text-amber-600 border-amber-200",
    SHORTAGE: "bg-red-50 text-red-500 border-red-200",
    IN_PROGRESS: "bg-[#2f6eb5]/10 text-[#2f6eb5] border-[#2f6eb5]/20",
    COMPLETED: "bg-[#4a7c59]/10 text-[#4a7c59] border-[#4a7c59]/20",
    CREATED: "bg-[#7c8091]/10 text-[#7c8091] border-black/10",
    RELEASED: "bg-[#4a7c59]/10 text-[#4a7c59] border-[#4a7c59]/20",
    CANCELLED: "bg-red-50 text-red-500 border-red-200",
    ALL_READY: "bg-[#4a7c59]/10 text-[#4a7c59] border-[#4a7c59]/20",
    PARTIAL_READY: "bg-amber-50 text-amber-600 border-amber-200",
    ADMIN: "bg-[#c24a08]/10 text-[#c24a08] border-[#c24a08]/20",
    WORKER: "bg-[#2f6eb5]/10 text-[#2f6eb5] border-[#2f6eb5]/20"
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold", map[status] ?? "bg-[#7c8091]/10 text-[#7c8091] border-black/10")}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function Empty({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-black/10 bg-[#f8f7f5] px-6 py-10 text-center">
      <div className="text-4xl">{icon}</div>
      <p className="font-bold text-[#1a1d23]">{title}</p>
      {hint && <p className="text-[13px] text-[#7c8091]">{hint}</p>}
    </div>
  );
}
