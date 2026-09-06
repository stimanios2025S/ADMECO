"use client";
import { useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { enqueue, peek, removeIds, queueCount, type QueuedOp } from "@/lib/offline/db";
import { useMes } from "@/lib/store/mes-store";

async function flushOne(supabase: any, op: QueuedOp): Promise<boolean> {
  try {
    switch (op.type) {
      case "STEP_SCAN": {
        const { error } = await supabase.from("work_order_steps").update({
          status: "ACTIVE", started_at: new Date().toISOString(), worker_id: op.payload.workerId
        }).eq("id", op.payload.stepId);
        return !error;
      }
      case "STEP_COMPLETE": {
        const { error } = await supabase.from("work_order_steps").update({
          status: "DONE", completed_at: new Date().toISOString(),
          good_units: op.payload.goodUnits, scrap_units: op.payload.scrapUnits,
          expected_units: op.payload.expectedUnits
        }).eq("id", op.payload.stepId);
        if (error) return false;
        if (op.payload.materialName) {
          await supabase.from("material_logs").insert({
            step_id: op.payload.stepId, material_name: op.payload.materialName,
            quantity_used: op.payload.qtyUsed, quantity_lost: op.payload.qtyLost,
            loss_reason: op.payload.lossReason ?? null
          });
        }
        return true;
      }
      case "TRANSFER_VERIFY": {
        const { error } = await supabase.from("site_transfers").update({
          status: op.payload.status, verified_at: new Date().toISOString()
        }).eq("id", op.payload.transferId);
        return !error;
      }
      default: return true;
    }
  } catch { return false; }
}

export function useOfflineQueue() {
  const { setOnline, setQueueCount, online } = useMes();
  const refresh = useCallback(async () => {
    setQueueCount(await queueCount());
    setOnline(navigator.onLine);
  }, [setOnline, setQueueCount]);

  useEffect(() => {
    refresh();
    const on = () => { setOnline(true); void drain(); };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const t = setInterval(refresh, 5000);
    void drain();
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const drain = useCallback(async () => {
    if (!navigator.onLine) return;
    const supabase = createClient();
    const q = await peek();
    const done: string[] = [];
    for (const op of q) if (await flushOne(supabase, op)) done.push(op.id);
    if (done.length) await removeIds(done);
    setQueueCount(await queueCount());
  }, [setQueueCount]);

  const submit = useCallback(async (op: Parameters<typeof enqueue>[0]) => {
    if (navigator.onLine) {
      const ok = await flushOne(createClient(), { ...op, id: "live", createdAt: "", attempts: 0 } as QueuedOp);
      if (ok) return { queued: false };
    }
    const n = await enqueue(op);
    setQueueCount(n);
    return { queued: true };
  }, [setQueueCount]);

  return { submit, drain, refresh, online };
}
