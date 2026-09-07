"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useRealtimeSteps(orderId?: string) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`steps-${orderId ?? "all"}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "work_order_steps" },
        () => setTick((t) => t + 1))
      .on("postgres_changes", { event: "*", schema: "public", table: "site_transfers" }, () => setTick((t) => t + 1))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orderId]);
  return tick;
}
