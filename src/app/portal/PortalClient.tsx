"use client";
import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMes } from "@/lib/store/mes-store";
import { parseQr } from "@/lib/qr/manifest";
import { cueSuccess, cueError, cueScrapAlert } from "@/lib/audio/cues";
import { useStepTimer } from "@/hooks/useStepTimer";
import Scanner from "@/components/qr/Scanner";
import KioskLock from "@/components/worker/KioskLock";
import CueOverlay from "@/components/worker/CueOverlay";
import { startStep, completeStep } from "@/app/actions";
import { Wifi, WifiOff, Play, CheckCircle2, ChevronRight } from "lucide-react";

type ActiveStep = {
  id: string; step_order: number; step_name: string; atelier_id: number;
  status: string; estimated_minutes: number; has_branch: boolean;
  started_at: string | null; item_id: string; item_name: string;
  item_quantity: number; design_notes: string; dimensions: any;
  qr_code_hash: string;
};

type MaterialRow = { stockItemId: string; stockItemName: string; unit: string; quantityUsed: number; quantityLost: number };

export default function PortalClient() {
  const { kiosk, flash, online } = useMes();
  const [step, setStep] = useState<ActiveStep | null>(null);
  const [msg, setMsg] = useState("");
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [branchChoice, setBranchChoice] = useState<"direct" | "indirect" | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useStepTimer(step?.started_at, step?.estimated_minutes ?? 0);

  const handleScan = useCallback(async (text: string) => {
    setMsg("");
    const parsed = parseQr(text);
    if (parsed.kind !== "STEP") { cueError(); setMsg("❌ Scan a step QR code"); return; }

    const supabase = createClient();
    const { data, error } = await supabase.from("work_order_steps")
      .select("*, work_order_items(product_name, quantity, design_notes, dimensions)")
      .eq("qr_code_hash", parsed.hash).single();
    if (error || !data) { cueError(); setMsg("❌ Unknown step QR"); return; }
    if (kiosk && data.atelier_id !== kiosk.atelierId) {
      cueError(); setMsg(`❌ This step is Atelier ${data.atelier_id}, station locked to ${kiosk.atelierId}`); return;
    }

    const item = data.work_order_items;
    setStep({
      id: data.id, step_order: data.step_order, step_name: data.step_name,
      atelier_id: data.atelier_id, status: data.status,
      estimated_minutes: data.estimated_minutes, has_branch: data.has_branch,
      started_at: data.started_at, item_id: data.item_id,
      item_name: item?.product_name ?? "—", item_quantity: item?.quantity ?? 0,
      design_notes: item?.design_notes ?? "", dimensions: item?.dimensions ?? {},
      qr_code_hash: data.qr_code_hash
    });
    setMaterials([]);
    setBranchChoice(null);
    cueSuccess();
    flash({ kind: "success", message: `Step ${data.step_order}: ${data.step_name}`, id: Date.now() });
  }, [kiosk, flash]);

  const handleStart = async () => {
    if (!step || !kiosk) return;
    setBusy(true);
    await startStep(step.id, kiosk.workerId);
    setStep((s) => s ? { ...s, status: "ACTIVE", started_at: new Date().toISOString() } : s);
    cueSuccess();
    setBusy(false);
  };

  const handleComplete = async () => {
    if (!step) return;
    setBusy(true);
    try {
      await completeStep({
        stepId: step.id,
        branchChoice: branchChoice ?? undefined,
        materials: materials.filter((m) => m.quantityUsed > 0 || m.quantityLost > 0).map((m) => ({
          stockItemId: m.stockItemId, quantityUsed: m.quantityUsed, quantityLost: m.quantityLost
        }))
      });
      cueSuccess();
      flash({ kind: "success", message: "Step completed ✅", id: Date.now() });
      setMsg(`✅ ${step.step_name} completed`);
      setStep(null); setMaterials([]); setBranchChoice(null);
    } catch (e: any) {
      cueError(); setMsg(`❌ ${e.message}`);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <CueOverlay />
      <div className={`flex items-center gap-2 rounded-xl px-4 py-2 font-bold ${online ? "bg-emerald-900 text-emerald-200" : "bg-red-900 text-red-200"}`}>
        {online ? <Wifi size={18} /> : <WifiOff size={18} />}
        {online ? "Online" : "Offline — inputs queued for sync"}
      </div>
      <KioskLock />

      <div className="glass p-4">
        <div className="font-black text-xl mb-2">📷 Scan step QR</div>
        <Scanner onScan={handleScan} />
        {msg && <p className="mt-2 text-lg font-bold">{msg}</p>}
      </div>

      {step && (
        <div className="glass space-y-4 border-2 border-fire/40 p-5">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-zinc-500">ITEM: {step.item_name} ×{step.item_quantity}</div>
              <div className="font-black text-xl">#{step.step_order} {step.step_name}</div>
              {step.design_notes && <div className="text-xs text-zinc-400 mt-0.5">Design: {step.design_notes}</div>}
            </div>
            <div className={`text-center rounded-xl px-4 py-2 ${timer.overdue ? "bg-red-600" : "bg-zinc-800"}`}>
              <div className="text-2xl font-mono font-black">⏱️ {timer.label}</div>
              {timer.overdue && <div className="text-xs font-bold">🔴 OVERDUE</div>}
            </div>
          </div>

          {/* Branch choice */}
          {step.has_branch && step.status === "ACTIVE" && !branchChoice && (
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4">
              <p className="font-black text-amber-300 mb-2">🔀 Choisissez le chemin :</p>
              <div className="flex gap-2">
                <button onClick={() => setBranchChoice("direct")} className="btn-fire flex-1 px-4 py-3 text-sm">
                  ⚡ DIRECT (passer l'étape intermédiaire)
                </button>
                <button onClick={() => setBranchChoice("indirect")} className="btn-ice flex-1 px-4 py-3 text-sm">
                  🔄 INDIRECT (ajouter étape intermédiaire)
                </button>
              </div>
            </div>
          )}
          {branchChoice && (
            <div className="rounded-xl bg-white/5 p-3 text-sm">
              <span className="font-bold">Chemin choisi : </span>
              {branchChoice === "direct" ? "⚡ Direct" : "🔄 Via étape intermédiaire"}
              <button onClick={() => setBranchChoice(null)} className="ml-2 text-xs text-zinc-400 hover:text-white">(changer)</button>
            </div>
          )}

          {/* Material declaration */}
          {step.status === "ACTIVE" && (
            <div className="space-y-2">
              <p className="font-black text-sm">📦 Matière utilisée :</p>
              <MaterialInput label="Matériau principal" unit="unité" onAdd={(m) => setMaterials((prev) => [...prev, m])} />
              {materials.map((m, i) => (
                <div key={i} className="glass-soft flex items-center gap-2 p-2.5 text-sm">
                  <span className="min-w-0 flex-1 font-bold">{m.stockItemName}</span>
                  <input type="number" min={0} step="any" value={m.quantityUsed}
                    onChange={(e) => setMaterials((prev) => prev.map((x, idx) => idx === i ? { ...x, quantityUsed: Number(e.target.value) } : x))}
                    className="w-20 rounded-lg bg-zinc-800 border px-2 py-1 text-center" placeholder="Used" title="Used" />
                  <input type="number" min={0} step="any" value={m.quantityLost}
                    onChange={(e) => setMaterials((prev) => prev.map((x, idx) => idx === i ? { ...x, quantityLost: Number(e.target.value) } : x))}
                    className="w-20 rounded-lg bg-zinc-800 border px-2 py-1 text-center" placeholder="Lost" title="Lost" />
                  <span className="text-xs text-zinc-500">{m.unit}</span>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {step.status === "PENDING" && (
              <button disabled={busy} onClick={handleStart} className="btn-fire flex-1 flex items-center justify-center gap-2 px-6 py-3">
                <Play size={18} /> {busy ? "Starting…" : "Start step"}
              </button>
            )}
            {step.status === "ACTIVE" && (
              <button disabled={busy} onClick={handleComplete} className="btn-fire flex-1 flex items-center justify-center gap-2 px-6 py-3">
                <CheckCircle2 size={18} /> {busy ? "Saving…" : "Complete step"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MaterialInput({ label, unit, onAdd }: { label: string; unit: string; onAdd: (m: MaterialRow) => void }) {
  const [name, setName] = useState("");
  const [qty, setQty] = useState(1);
  return (
    <form className="flex gap-2" onSubmit={(e) => {
      e.preventDefault();
      if (name.trim()) {
        onAdd({ stockItemId: crypto.randomUUID(), stockItemName: name.trim(), unit, quantityUsed: qty, quantityLost: 0 });
        setName(""); setQty(1);
      }
    }}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du matériau"
        className="glass-input flex-1 px-3 py-2 text-sm" />
      <input type="number" min={0} step="any" value={qty} onChange={(e) => setQty(Number(e.target.value))}
        className="glass-input w-24 px-2 py-2 text-sm text-center" />
      <button className="btn-ghost px-3 py-2 text-sm font-bold">+ Add</button>
    </form>
  );
}
