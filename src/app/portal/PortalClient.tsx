"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMes } from "@/lib/store/mes-store";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import { parseQr } from "@/lib/qr/manifest";
import { cueSuccess, cueError, cueScrapAlert } from "@/lib/audio/cues";
import { scrapPct } from "@/lib/calc/yield";
import { useStepTimer } from "@/hooks/useStepTimer";
import Scanner from "@/components/qr/Scanner";
import KioskLock from "@/components/worker/KioskLock";
import MaterialYieldForm, { type YieldInput } from "@/components/worker/MaterialYieldForm";
import CueOverlay from "@/components/worker/CueOverlay";
import BatchSplitDialog from "@/components/worker/BatchSplitDialog";
import { Wifi, WifiOff } from "lucide-react";

type ActiveStep = {
  id: string; step_order: number; step_name: string; atelier_id: number;
  status: string; estimated_minutes: number; expected_units: number;
  started_at: string | null; work_order_id: string; order_number: string;
  standard_material: string; standard_qty: number;
};

export default function PortalClient() {
  const { kiosk, flash, online, queueCount } = useMes();
  const { submit } = useOfflineQueue();
  const [step, setStep] = useState<ActiveStep | null>(null);
  const [msg, setMsg] = useState("");
  const [verifying, setVerifying] = useState(false);
  const timer = useStepTimer(step?.started_at, step?.estimated_minutes ?? 0);

  const handleScan = async (text: string) => {
    setMsg("");
    const parsed = parseQr(text);
    const supabase = createClient();

    // 1) Pallet manifest scan → verify transfer (Site B receiving)
    if (parsed.kind === "MNF") {
      setVerifying(true);
      try {
        const res = await fetch("/api/manifest/verify", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ manifest: parsed.manifest })
        });
        const j = await res.json();
        if (!j.ok) { cueError(); flash({ kind: "error", message: "Manifest not found", id: Date.now() }); setMsg("❌ Manifest not found"); return; }
        if (kiosk) {
          const r = await submit({ type: "TRANSFER_VERIFY", payload: { transferId: j.transfer.id, status: "VERIFIED" } });
          cueSuccess();
          flash({ kind: "success", message: r.queued ? "Verified (queued offline)" : `Verified ${j.transfer.item_count} items ✅`, id: Date.now() });
          setMsg(`✅ Manifest ${j.transfer.manifest_qr}: ${j.transfer.item_count} items verified${r.queued ? " (offline queue)" : ""}`);
        } else {
          setMsg(`Manifest ${j.transfer.manifest_qr}: ${j.transfer.item_count} items — lock station first to verify.`);
        }
      } finally { setVerifying(false); }
      return;
    }

    // 2) Step QR scan → activate + start timer
    if (parsed.kind === "STEP") {
      const { data, error } = await supabase.from("work_order_steps")
        .select("*, work_orders!inner(order_number)")
        .eq("qr_code_hash", parsed.hash).single();
      if (error || !data) { cueError(); flash({ kind: "error", message: "Unknown step QR", id: Date.now() }); setMsg("❌ Unknown step QR code"); return; }
      if (kiosk && data.atelier_id !== kiosk.atelierId) {
        cueError(); flash({ kind: "error", message: "Wrong atelier!", id: Date.now() });
        setMsg(`❌ This step belongs to Atelier ${data.atelier_id}, station locked to ${kiosk.atelierId}`); return;
      }
      const { data: tmpl } = await supabase.from("process_templates").select("standard_material,standard_qty")
        .eq("step_order", data.step_order).limit(1).single();
      setStep({
        id: data.id, step_order: data.step_order, step_name: data.step_name, atelier_id: data.atelier_id,
        status: data.status, estimated_minutes: data.estimated_minutes, expected_units: data.expected_units ?? 0,
        started_at: data.started_at ?? new Date().toISOString(),
        work_order_id: data.work_order_id, order_number: (data as any).work_orders.order_number,
        standard_material: tmpl?.standard_material ?? "", standard_qty: Number(tmpl?.standard_qty ?? 0)
      });
      if (data.status === "PENDING" && kiosk) {
        await submit({ type: "STEP_SCAN", payload: { stepId: data.id, workerId: kiosk.workerId } });
      }
      cueSuccess();
      flash({ kind: "success", message: `Step ${data.step_order} started`, id: Date.now() });
      setMsg(`✅ ${data.step_name} — timer running`);
      return;
    }
    cueError(); setMsg("❌ Unrecognized code");
  };

  const handleComplete = async (v: YieldInput) => {
    if (!step) return;
    const sp = scrapPct(v.goodUnits, v.scrapUnits);
    const r = await submit({
      type: "STEP_COMPLETE",
      payload: {
        stepId: step.id, goodUnits: v.goodUnits, scrapUnits: v.scrapUnits, expectedUnits: v.expectedUnits,
        materialName: v.materialName, qtyUsed: v.qtyUsed, qtyLost: v.qtyLost, lossReason: v.lossReason
      }
    });
    if (sp > 5) { cueScrapAlert(); flash({ kind: "scrap", message: `Scrap ${sp.toFixed(1)}% — over limit!`, id: Date.now() }); }
    else { cueSuccess(); flash({ kind: "success", message: r.queued ? "Saved offline — will sync" : "Step completed ✅", id: Date.now() }); }
    setMsg(r.queued ? "📥 Saved to offline queue — auto-sync when reconnected" : "✅ Step completed & logged");
    setStep(null);
  };

  return (
    <div className="space-y-4">
      <CueOverlay />
      <div className={`flex items-center gap-2 rounded-xl px-4 py-2 font-bold ${online ? "bg-emerald-900 text-emerald-200" : "bg-red-900 text-red-200"}`}>
        {online ? <Wifi size={18} /> : <WifiOff size={18} />}
        {online ? "Online" : `Offline — ${queueCount} queued (auto-sync on reconnect)`}
      </div>
      <KioskLock />
      <div className="rounded-2xl bg-zinc-900 border border-zinc-700 p-4">
        <div className="font-black text-xl mb-2">📷 1-tap QR scan</div>
        <Scanner onScan={handleScan} paused={verifying} />
        {msg && <p className="mt-2 text-lg font-bold">{msg}</p>}
      </div>
      {step && (
        <div className="space-y-3 rounded-2xl border-2 border-yellow-400 bg-zinc-950 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-black text-xl">#{step.step_order} {step.step_name}</div>
              <div className="text-zinc-400 text-sm">{step.order_number} · expected ×{step.expected_units} · target {step.estimated_minutes} min</div>
            </div>
            <div className={`text-center rounded-xl px-4 py-2 ${timer.overdue ? "bg-red-600" : "bg-zinc-800"}`}>
              <div className="text-2xl font-mono font-black">⏱️ {timer.label}</div>
              {timer.overdue && <div className="text-xs font-bold">🔴 OVERDUE</div>}
            </div>
          </div>
          <MaterialYieldForm
            standardMaterial={step.standard_material}
            standardQty={step.standard_qty}
            expectedUnits={step.expected_units}
            onSubmit={handleComplete}
          />
          <BatchSplitDialog stepId={step.id} expected={step.expected_units} />
        </div>
      )}
    </div>
  );
}
