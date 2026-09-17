"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMes } from "@/lib/store/mes-store";
import type { AtelierId } from "@/lib/ateliers";
import { parseQr } from "@/lib/qr/manifest";
import { cueSuccess, cueError, cueScrapAlert } from "@/lib/audio/cues";
import { useStepTimer } from "@/hooks/useStepTimer";
import Scanner from "@/components/qr/Scanner";
import KioskLock from "@/components/worker/KioskLock";
import CueOverlay from "@/components/worker/CueOverlay";
import { startStep } from "@/app/actions";
import { declarerProduction } from "@/app/actions-portail";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import { signalerSync } from "./PortalSync";
import { Wifi, WifiOff, Play, CheckCircle2, Plus, X } from "lucide-react";

type ActiveStep = {
  id: string; step_order: number; step_name: string; atelier_id: number;
  status: string; estimated_minutes: number; has_branch: boolean;
  branch_insert_name: string | null; branch_insert_minutes: number;
  started_at: string | null; item_id: string; item_name: string;
  item_quantity: number; design_notes: string; dimensions: any;
  qr_code_hash: string;
};

type MaterialRow = { stockItemId: string; stockItemName: string; unit: string; quantityUsed: number; quantityLost: number };

const A1 = "#c24a08";
const A2 = "#2f6eb5";
const M1 = "#7c3aed";

export default function PortalClient({ mode = "factory", atelierId, etape }: { mode?: "factory" | "warehouse"; atelierId?: AtelierId | null; etape?: number | null }) {
  const { kiosk, flash, online, queueCount } = useMes();
  const { submit } = useOfflineQueue();
  const atelierCible = atelierId ?? kiosk?.atelierId ?? null;
  const etapeCible = etape ?? kiosk?.stepOrder ?? null;
  const accent = atelierCible === 1 ? A1 : atelierCible === 2 ? A2 : atelierCible === 3 ? M1 : "#4a7c59";
  const [step, setStep] = useState<ActiveStep | null>(null);
  const [msg, setMsg] = useState("");
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [quantiteOk, setQuantiteOk] = useState(0);
  const [quantitePerdue, setQuantitePerdue] = useState(0);
  const [quantiteReutilisee, setQuantiteReutilisee] = useState(0);
  const [branchChoice, setBranchChoice] = useState<"direct" | "indirect" | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useStepTimer(step?.started_at, step?.estimated_minutes ?? 0);

  const handleScan = useCallback(async (text: string) => {
    setMsg("");
    const parsed = parseQr(text);
    if (parsed.kind !== "STEP") { cueError(); setMsg("❌ Scannez un QR d'étape"); return; }

    const supabase = createClient();
    const { data, error } = await supabase.from("work_order_steps")
      .select("*, work_order_items(product_name, quantity, category_id, design_notes, dimensions)")
      .eq("qr_code_hash", parsed.hash).single();
    if (error || !data) { cueError(); setMsg("❌ QR d'étape inconnu"); return; }
    const poste = kiosk?.atelierId ?? atelierId ?? null;
    if (poste && data.atelier_id !== poste) {
      cueError(); setMsg(`❌ Cette étape est Atelier ${data.atelier_id}, poste verrouillé sur ${poste}`); return;
    }
    if (atelierId && data.atelier_id !== atelierId) {
      cueError(); setMsg(`❌ Cette étape appartient à l'Atelier ${data.atelier_id} — portail Atelier ${atelierId}`); return;
    }
    if (etapeCible && Number(data.step_order) !== Number(etapeCible)) {
      cueError(); setMsg(`❌ Ce QR est l'Étape ${data.step_order} — ce portail est verrouillé sur l'Étape ${etapeCible}`); return;
    }

    const item = data.work_order_items;

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
    setQuantiteOk(item?.quantity ?? 0);
    setQuantitePerdue(0);
    setQuantiteReutilisee(0);
    setBranchChoice(null);
    cueSuccess();
    flash({ kind: "success", message: `Étape ${data.step_order} : ${data.step_name}`, id: Date.now() });
  }, [kiosk, flash, atelierId, etapeCible]);

  const handleStart = async () => {
    if (!step || !kiosk) return;
    setBusy(true);
    try {
      await startStep(step.id, kiosk.workerId);
      setStep((s) => s ? { ...s, status: "ACTIVE", started_at: new Date().toISOString() } : s);
      cueSuccess();
      signalerSync();
    } catch (e: any) {
      // Hors ligne : mettre en file, la synchro la rejouera au retour réseau
      const r = await submit({ type: "STEP_SCAN", payload: { stepId: step.id } });
      if (r.queued) {
        setStep((s) => s ? { ...s, status: "ACTIVE", started_at: new Date().toISOString() } : s);
        cueSuccess();
        setMsg("📥 Hors ligne — démarrage enregistré, sera synchronisé.");
      } else {
        cueError(); setMsg(`❌ ${e.message}`);
      }
    }
    setBusy(false);
  };

  const handleComplete = async () => {
    if (!step) return;
    setBusy(true);
    try {
      const res = await declarerProduction({
        stepId: step.id,
        quantiteOk,
        quantitePerdue,
        quantiteReutilisee,
        branchChoice: branchChoice ?? undefined,
        materials: materials.filter((m) => m.quantityUsed > 0 || m.quantityLost > 0).map((m) => ({
          stockItemId: m.stockItemId, quantityUsed: m.quantityUsed, quantityLost: m.quantityLost
        })),
        nextStepName: branchChoice === "indirect" ? step.branch_insert_name ?? undefined : undefined,
        nextStepMinutes: branchChoice === "indirect" ? step.branch_insert_minutes : undefined
      });
      if (!res.ok) throw new Error(res.message);
      cueSuccess();
      flash({ kind: "success", message: "Étape terminée ✅", id: Date.now() });
      setMsg(`✅ ${res.message}`);
      setStep(null); setMaterials([]); setBranchChoice(null);
      signalerSync();
    } catch (e: any) {
      cueError(); setMsg(`❌ ${e.message}`);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <CueOverlay />

      {/* ── Connection status ── */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-black/[0.04] bg-white p-3.5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className={`grid h-10 w-10 place-items-center rounded-xl ${online ? "bg-[#4a7c59]/10 text-[#4a7c59]" : "bg-red-50 text-red-400"}`}>
            {online ? <Wifi size={18} /> : <WifiOff size={18} />}
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#9ca3af]">Connexion</p>
            <p className="text-sm font-bold text-[#1a1d23]">{online ? (queueCount > 0 ? `En ligne — ${queueCount} en attente` : "En ligne et synchronisé") : "Hors ligne"}</p>
          </div>
        </div>
        <span className="rounded-full border border-black/[0.04] bg-black/[0.02] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#9ca3af]">
          {atelierCible === 1 ? `Atelier 1${etapeCible ? ` · Étape ${etapeCible}` : ""}` : atelierCible === 2 ? `Atelier 2${etapeCible ? ` · Étape ${etapeCible}` : ""}` : "Mode usine"}
        </span>
      </div>

      {/* ── Kiosk lock ── */}
      <KioskLock atelierId={atelierId} etape={etape} />

      {/* ── QR Scanner ── */}
      <div className="rounded-2xl border border-black/[0.04] bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#9ca3af]">Prise d'étape</p>
            <div className="mt-1 text-xl font-black tracking-tight text-[#1a1d23]">Scanner le QR de production</div>
          </div>
          <span className="rounded-full bg-[#4a7c59]/10 px-2.5 py-1 text-[10px] font-bold text-[#4a7c59]">Tablette prête</span>
        </div>
        <Scanner onScan={handleScan} />
        {msg && (
          <div className="mt-3 rounded-xl border border-black/[0.04] bg-black/[0.02] px-3 py-2.5 text-sm font-bold text-[#1a1d23]">
            {msg}
          </div>
        )}
      </div>

      {/* ── Active step detail ── */}
      {step && (
        <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: `${accent}25` }}>
          {/* Step header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#9ca3af]">
                Article {step.item_name} ×{step.item_quantity}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-black text-white" style={{ background: accent }}>
                  {step.step_order}
                </span>
                <h3 className="text-xl font-black tracking-tight text-[#1a1d23]">{step.step_name}</h3>
              </div>
              {step.design_notes && <p className="mt-1 text-xs text-[#9ca3af]">Design : {step.design_notes}</p>}
            </div>
            <div className="shrink-0 rounded-2xl px-3 py-2 text-center" style={timer.overdue ? { background: "rgba(239,68,68,.08)", color: "#dc2626" } : { background: "rgba(0,0,0,.03)", color: "#1a1d23" }}>
              <div className="font-mono text-xl font-black">{timer.label}</div>
              {timer.overdue && <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-500">En retard</div>}
            </div>
          </div>

          {/* Branch choice */}
          {step.has_branch && step.status === "ACTIVE" && !branchChoice && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="mb-3 text-sm font-black text-amber-800">Choisir le chemin :</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button onClick={() => setBranchChoice("direct")}
                  className="flex-1 rounded-xl border border-amber-300 bg-white px-4 py-3 text-sm font-bold text-amber-800 hover:bg-amber-50 transition-colors">
                  ⚡ Chemin direct
                </button>
                <button onClick={() => setBranchChoice("indirect")}
                  className="flex-1 rounded-xl border border-blue-300 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800 hover:bg-blue-100 transition-colors">
                  🔄 Chemin indirect
                </button>
              </div>
            </div>
          )}

          {branchChoice && (
            <div className="mt-3 rounded-xl bg-black/[0.02] px-3 py-2 text-sm">
              <span className="font-bold text-[#1a1d23]">Chemin choisi : </span>
              <span className="text-[#6b7280]">{branchChoice === "direct" ? "⚡ Direct" : "🔄 Via étape intermédiaire"}</span>
              <button onClick={() => setBranchChoice(null)} className="ml-2 text-xs text-[#9ca3af] hover:text-[#1a1d23] underline">(modifier)</button>
            </div>
          )}

          {/* Production declaration */}
          {step.status === "ACTIVE" && (
            <div className="mt-4 space-y-2.5">
              <p className="text-sm font-black text-[#1a1d23]">Déclaration de production</p>
              <div className="grid grid-cols-3 gap-2">
                <label className="rounded-xl bg-[#4a7c59]/[0.06] p-2.5">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.15em] text-[#4a7c59]">✅ Produites</span>
                  <input type="number" min={0} step="any" value={quantiteOk}
                    onChange={(e) => setQuantiteOk(Math.max(0, Number(e.target.value)))}
                    className="mt-1 w-full bg-transparent text-center text-xl font-black text-[#1a1d23] focus:outline-none" />
                </label>
                <label className="rounded-xl bg-red-50 p-2.5">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.15em] text-red-500">❌ Perdues</span>
                  <input type="number" min={0} step="any" value={quantitePerdue}
                    onChange={(e) => setQuantitePerdue(Math.max(0, Number(e.target.value)))}
                    className="mt-1 w-full bg-transparent text-center text-xl font-black text-[#1a1d23] focus:outline-none" />
                </label>
                <label className="rounded-xl bg-amber-50 p-2.5">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.15em] text-amber-600">♻️ Réutilisées</span>
                  <input type="number" min={0} step="any" value={quantiteReutilisee}
                    onChange={(e) => setQuantiteReutilisee(Math.max(0, Number(e.target.value)))}
                    className="mt-1 w-full bg-transparent text-center text-xl font-black text-[#1a1d23] focus:outline-none" />
                </label>
              </div>
              <p className="text-sm font-black text-[#1a1d23]">Consommation matière</p>
              <MaterialInput onAdd={(m) => setMaterials((prev) => [...prev, m])} />
              {materials.length > 0 && (
                <div className="space-y-1.5">
                  {materials.map((m, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-xl bg-black/[0.02] p-2.5 text-sm">
                      <span className="min-w-0 flex-1 font-bold text-[#1a1d23]">{m.stockItemName}</span>
                      <input type="number" min={0} step="any" value={m.quantityUsed}
                        onChange={(e) => setMaterials((prev) => prev.map((x, idx) => idx === i ? { ...x, quantityUsed: Number(e.target.value) } : x))}
                        className="w-20 rounded-lg border border-black/[0.08] bg-white px-2 py-1.5 text-center text-sm text-[#1a1d23] focus:outline-none focus:ring-2 focus:ring-[#4a7c59]/20"
                        placeholder="Utilisé" title="Utilisé" />
                      <input type="number" min={0} step="any" value={m.quantityLost}
                        onChange={(e) => setMaterials((prev) => prev.map((x, idx) => idx === i ? { ...x, quantityLost: Number(e.target.value) } : x))}
                        className="w-20 rounded-lg border border-black/[0.08] bg-white px-2 py-1.5 text-center text-sm text-[#1a1d23] focus:outline-none focus:ring-2 focus:ring-red-200"
                        placeholder="Perdu" title="Perdu" />
                      <span className="text-xs text-[#9ca3af]">{m.unit}</span>
                      <button onClick={() => setMaterials((prev) => prev.filter((_, idx) => idx !== i))}
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[#9ca3af] hover:text-red-500 hover:bg-red-50 transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-5 flex gap-2">
            {step.status === "PENDING" && (
              <button disabled={busy} onClick={handleStart}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-bold text-white transition-all disabled:opacity-40"
                style={{ background: accent }}>
                {busy ? "Démarrage…" : <><Play size={18} /> Démarrer l'étape</>}
              </button>
            )}
            {step.status === "ACTIVE" && (
              <button disabled={busy} onClick={handleComplete}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-bold text-white transition-all disabled:opacity-40"
                style={{ background: "#4a7c59" }}>
                {busy ? "Enregistrement…" : <><CheckCircle2 size={18} /> Terminer l'étape</>}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Material input sub-component (sélection du vrai stock MP) ── */
function MaterialInput({ onAdd }: { onAdd: (m: MaterialRow) => void }) {
  const [stocks, setStocks] = useState<Array<{ id: string; name: string; unit: string; quantity: number }>>([]);
  const [sel, setSel] = useState("");
  const [qty, setQty] = useState(1);
  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.from("stock_items").select("id,name,unit,quantity").order("name").limit(100);
        if (data) setStocks(data as any);
      } catch { /* liste optionnelle */ }
    })();
  }, []);
  return (
    <form className="flex gap-2" onSubmit={(e) => {
      e.preventDefault();
      const found = stocks.find((s) => s.id === sel);
      if (found) {
        onAdd({ stockItemId: found.id, stockItemName: found.name, unit: found.unit ?? "pcs", quantityUsed: qty, quantityLost: 0 });
        setSel(""); setQty(1);
      }
    }}>
      <select value={sel} onChange={(e) => setSel(e.target.value)}
        className="flex-1 rounded-xl border border-black/[0.08] bg-white px-3 py-2.5 text-sm text-[#1a1d23] focus:outline-none focus:ring-2 focus:ring-[#4a7c59]/20">
        <option value="">Choisir la matière…</option>
        {stocks.map((s) => (
          <option key={s.id} value={s.id}>{s.name} (reste {s.quantity} {s.unit ?? ""})</option>
        ))}
      </select>
      <input type="number" min={0} step="any" value={qty} onChange={(e) => setQty(Math.max(0, Number(e.target.value)))}
        className="w-24 rounded-xl border border-black/[0.08] bg-white px-2 py-2.5 text-center text-sm text-[#1a1d23] focus:outline-none focus:ring-2 focus:ring-[#4a7c59]/20" />
      <button className="flex items-center gap-1 rounded-xl border border-black/[0.06] bg-black/[0.02] px-3 py-2.5 text-sm font-bold text-[#6b7280] hover:bg-black/[0.04] transition-colors">
        <Plus size={14} /> Ajouter
      </button>
    </form>
  );
}
