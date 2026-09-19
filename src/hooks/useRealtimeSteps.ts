"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";

/**
 * Horloge temps réel : s'incrémente à chaque changement sur les tables
 * de production (étapes, transferts, logs matière). Les files d'ateliers
 * écoutent l'événement "mes-sync" diffusé par PortalSync pour se recharger.
 * Inactif en mode démo (pas de Realtime) — aucun crash.
 */
export function useRealtimeSteps(orderId?: string) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!hasSupabaseConfig()) return;
    let supabase: any = null;
    let ch: any = null;
    try {
      supabase = createClient();
      ch = supabase
        .channel(`steps-${orderId ?? "all"}`)
        .on("postgres_changes",
          { event: "*", schema: "public", table: "work_order_steps" },
          () => setTick((t) => t + 1))
        .on("postgres_changes",
          { event: "*", schema: "public", table: "site_transfers" },
          () => setTick((t) => t + 1))
        .on("postgres_changes",
          { event: "*", schema: "public", table: "material_logs" },
          () => setTick((t) => t + 1))
        .subscribe();
    } catch {
      /* Realtime indisponible — le bouton Synchroniser reste utilisable */
    }
    return () => {
      try { if (supabase && ch) supabase.removeChannel(ch); } catch { /* ignore */ }
    };
  }, [orderId]);
  return tick;
}
