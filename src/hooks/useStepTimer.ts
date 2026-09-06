"use client";
import { useEffect, useState } from "react";
export function useStepTimer(startedAt?: string | null, estimatedMinutes = 0) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!startedAt) return { elapsedMin: 0, overdue: false, label: "—" };
  const elapsedMin = (now - new Date(startedAt).getTime()) / 60000;
  const overdue = elapsedMin > estimatedMinutes;
  const m = Math.floor(elapsedMin);
  const s = Math.floor((elapsedMin - m) * 60);
  return { elapsedMin, overdue, label: `${m}:${String(s).padStart(2, "0")}` };
}
