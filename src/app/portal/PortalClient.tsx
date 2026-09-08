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
  branch_insert_name: string | null; branch_insert_minutes: number;
  started_at: string | null; item_id: string; item_name: string;
  item_quantity: number; design_notes: string; dimensions: any;
  qr_code_hash: string;
};

type MaterialRow = { stockItemId: string; stockItemName: string; unit: string; quantityUsed: number; quantityLost: number };

export default function PortalClient({ mode = "factory" }: { mode?: "factory" | "warehouse" }) {
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

    // Fetch branch template data for indirect path
    let branchName: string | null = null;
    let branchMinutes = 20;
    if (data.has_branch) {
      const { data: tpl } = await supabase.from("process_templates")
        .select("branch_insert_name, branch_insert_minutes")
        .eq("category_id", item?.category_id)
        .eq("step_order", data.step_order).maybeSingle();
      if (tpl) { branchName = tpl.branch_insert_name; branchMinutes = tpl.branch_insert_minutes; }
    }

    setStep({
      id: data.id, step_order: data.step_order, step_name: data.step_name,
      atelier_id: data.atelier_id, status: data.status,
      estimated_minutes: data.estimated_minutes, has_branch: data.has_branch,
      branch_insert_name: branchName, branch_insert_minutes: branchMinutes,
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
        })),
        nextStepName: branchChoice === "indirect" ? step.branch_insert_name ?? undefined : undefined,
        nextStepMinutes: branchChoice === "indirect" ? step.branch_insert_minutes : undefined
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
    <div className="space-y-5">
      <CueOverlay />

      <div className="glass flex items-center justify-between gap-3 rounded-2xl p-3.5">
        <div className="flex items-center gap-3">
          <div className={`grid h-10 w-10 place-items-center rounded-xl ${online ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>
            {online ? <Wifi size={18} /> : <WifiOff size={18} />}
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">Connection</p>
            <p className="text-sm font-bold text-white">{online ? "Online and synced" : "Offline — queued for sync"}</p>
          </div>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-300">
          {mode === "warehouse" ? "Warehouse mode" : "Factory mode"}
        </div>
      </div>

      <KioskLock />

      <div className="premium-card rounded-[26px] p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Step intake</p>
            <div className="mt-1 text-xl font-black tracking-tight">Scan production QR</div>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
            Tablet ready
          </div>
        </div>
        <Scanner onScan={handleScan} />
        {msg && <p className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-zinc-100">{msg}</p>}
      </div>

      {step && (
        <div className="premium-card space-y-4 rounded-[26px] border border-fire/30 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">Item {step.item_name} ×{step.item_quantity}</div>
              <div className="mt-1 text-2xl font-black tracking-tight">#{step.step_order} {step.step_name}</div>
              {step.design_notes && <div className="mt-1 text-xs text-zinc-400">Design: {step.design_notes}</div>}
            </div>
            <div className={`min-w-[130px] rounded-2xl px-3 py-2 text-center ${timer.overdue ? "bg-red-500/15 text-red-200" : "bg-white/5 text-zinc-100"}`}>
              <div className="font-mono text-xl font-black">{timer.label}</div>
              {timer.overdue && <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-300">Overdue</div>}
            </div>
          </div>

          {step.has_branch && step.status === "ACTIVE" && !branchChoice && (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
              <p className="mb-3 text-sm font-black text-amber-200">Choose path :</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button onClick={() => setBranchChoice("direct")} className="btn-fire flex-1 px-4 py-3 text-sm">
                  ⚡ Direct branch
                </button>
                <button onClick={() => setBranchChoice("indirect")} className="btn-ice flex-1 px-4 py-3 text-sm">
                  🔄 Indirect branch
                </button>
              </div>
            </div>
          )}

          {branchChoice && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm">
              <span className="font-bold text-zinc-200">Path chosen: </span>
              {branchChoice === "direct" ? "⚡ Direct" : "🔄 Via intermediate step"}
              <button onClick={() => setBranchChoice(null)} className="ml-2 text-xs text-zinc-400 hover:text-white">(change)</button>
            </div>
          )}

          {step.status === "ACTIVE" && (
            <div className="space-y-2.5">
              <p className="text-sm font-black text-zinc-200">Material usage</p>
              <MaterialInput label="Main material" unit="unit" onAdd={(m) => setMaterials((prev) => [...prev, m])} />
              {materials.map((m, i) => (
                <div key={i} className="glass-soft flex items-center gap-2 p-2.5 text-sm">
                  <span className="min-w-0 flex-1 font-bold text-white">{m.stockItemName}</span>
                  <input type="number" min={0} step="any" value={m.quantityUsed}
                    onChange={(e) => setMaterials((prev) => prev.map((x, idx) => idx === i ? { ...x, quantityUsed: Number(e.target.value) } : x))}
                    className="w-20 rounded-lg border border-white/10 bg-zinc-900 px-2 py-1 text-center text-white" placeholder="Used" title="Used" />
                  <input type="number" min={0} step="any" value={m.quantityLost}
                    onChange={(e) => setMaterials((prev) => prev.map((x, idx) => idx === i ? { ...x, quantityLost: Number(e.target.value) } : x))}
                    className="w-20 rounded-lg border border-white/10 bg-zinc-900 px-2 py-1 text-center text-white" placeholder="Lost" title="Lost" />
                  <span className="text-xs text-zinc-500">{m.unit}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            {step.status === "PENDING" && (
              <button disabled={busy} onClick={handleStart} className="btn-fire flex-1 px-6 py-3">
                <span className="flex items-center justify-center gap-2"><Play size={18} /> {busy ? "Starting…" : "Start step"}</span>
              </button>
            )}
            {step.status === "ACTIVE" && (
              <button disabled={busy} onClick={handleComplete} className="btn-fire flex-1 px-6 py-3">
                <span className="flex items-center justify-center gap-2"><CheckCircle2 size={18} /> {busy ? "Saving…" : "Complete step"}</span>
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
