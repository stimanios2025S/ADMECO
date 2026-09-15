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

  const styles: Record<string, { bg: string; icon: string }> = {
    success: { bg: "bg-[#4a7c59]", icon: "✅" },
    scrap: { bg: "bg-[#c24a08]", icon: "⚠️" },
    error: { bg: "bg-red-600", icon: "❌" },
  };
  const s = styles[cue.kind] ?? styles.error;

  return (
    <div className={`fixed inset-0 z-[100] ${s.bg} flex items-center justify-center animate-pulse`}>
      <div className="text-center text-white">
        <div className="text-7xl">{s.icon}</div>
        <div className="mt-2 text-3xl font-black">{cue.message}</div>
      </div>
    </div>
  );
}
