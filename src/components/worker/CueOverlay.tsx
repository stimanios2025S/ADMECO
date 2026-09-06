"use client";
import { useEffect } from "react";
import { useMes } from "@/lib/store/mes-store";

export default function CueOverlay() {
  const { cue, clearCue } = useMes();
  useEffect(() => {
    if (!cue) return;
    const t = setTimeout(clearCue, 1800);
    return () => clearTimeout(t);
  }, [cue, clearCue]);
  if (!cue) return null;
  const bg = cue.kind === "success" ? "bg-emerald-500" : cue.kind === "scrap" ? "bg-orange-500" : "bg-red-600";
  return (
    <div className={`fixed inset-0 z-[100] ${bg} flex items-center justify-center animate-pulse`}>
      <div className="text-center text-white">
        <div className="text-7xl">{cue.kind === "success" ? "✅" : "⚠️"}</div>
        <div className="text-3xl font-black mt-2">{cue.message}</div>
      </div>
    </div>
  );
}
