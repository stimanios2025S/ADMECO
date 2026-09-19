"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Flag, Target, Loader2, CheckCircle2 } from "lucide-react";
import { changerPriorite, fixerObjectif } from "@/app/actions-usines";
import QrEtapes from "@/components/admin/QrEtapes";
import { ETAPES_A1_GAMME } from "@/lib/process-eco";
import { cn } from "@/lib/utils";

const PRIORITES = [
  { v: 1, label: "🔴 Urgente" },
  { v: 2, label: "🟠 Haute" },
  { v: 3, label: "🟢 Normale" },
  { v: 4, label: "🔵 Basse" },
  { v: 5, label: "⚪ Très basse" },
];

// Panneau admin d'une commande ECO : priorité + objectifs du matin + QR à imprimer.
// À monter dans /admin/orders/[id] quand product_line === 'ECO' (repli : design_notes contient 'Suivi ECO').
export default function PanneauEco({ order, steps }: { order: any; steps: any[] }) {
  const router = useRouter();
  const [prio, setPrio] = useState(Number(order?.priority) || 3);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [objectifs, setObjectifs] = useState<Record<string, number>>(() => {
    const o: Record<string, number> = {};
    for (const s of steps) o[s.id] = Number(s.target_qty) || 0;
    return o;
  });

  const sauverPriorite = async (v: number) => {
    setPrio(v);
    setBusy(true);
    setMsg("");
    const r = await changerPriorite(order.id, v);
    setMsg(r.ok ? `✅ ${r.message}` : `❌ ${r.message}`);
    if (r.ok) router.refresh();
    setBusy(false);
  };

  const sauverObjectif = async (stepId: string) => {
    setBusy(true);
    setMsg("");
    const r = await fixerObjectif(stepId, objectifs[stepId] ?? 0);
    setMsg(r.ok ? `✅ ${r.message}` : `❌ ${r.message}`);
    if (r.ok) router.refresh();
    setBusy(false);
  };

  // Toute la gamme A1 est postée : les 6 postes de production ET l'étape 7
  // (transfert vers l'Atelier 3), où l'ouvrier déclare OK/perdu et édite le
  // bordereau. Le nombre d'étapes n'est plus figé ici.
  const dernierOrdre = ETAPES_A1_GAMME.length;
  const etapesQR = steps.filter(
    (s: any) => Number(s.step_order) >= 1 && Number(s.step_order) <= dernierOrdre
  );
  const estEco =
    String(order?.product_line ?? "").toUpperCase() === "ECO" ||
    /suivi eco/i.test(steps.map((s: any) => s.step_name).join(" "));

  if (!estEco) return null;

  return (
    <div className="space-y-4">
      {msg && (
        <div className={cn("rounded-2xl border p-3.5 text-sm font-bold", msg.startsWith("✅") ? "border-[#4a7c59]/20 bg-[#4a7c59]/[0.06] text-[#4a7c59]" : "border-red-200 bg-red-50 text-red-600")}>
          {msg}
        </div>
      )}

      {/* ── Priorité ── */}
      <div className="card p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#9ca3af]">Priorité de la commande</p>
        <h3 className="mt-1 flex items-center gap-2 text-lg font-black tracking-tight text-[#1a1d23]">
          <Flag size={17} className="text-[#c24a08]" /> {order.order_number}
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {PRIORITES.map((p) => (
            <button key={p.v} disabled={busy} onClick={() => sauverPriorite(p.v)}
              className={cn("rounded-xl border px-3.5 py-2 text-[13px] font-bold transition-all disabled:opacity-40",
                prio === p.v ? "border-[#c24a08]/40 bg-[#c24a08]/[0.06] text-[#c24a08]" : "border-black/[0.06] text-[#6b7280] hover:border-black/[0.12]")}>
              {p.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-[#9ca3af]">Le portail ouvrier trie les commandes : urgentes d'abord.</p>
      </div>

      {/* ── Objectifs du matin par étape ── */}
      <div className="card p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#9ca3af]">Objectifs du matin</p>
        <h3 className="mt-1 flex items-center gap-2 text-lg font-black tracking-tight text-[#1a1d23]">
          <Target size={17} className="text-[#c24a08]" /> Combien produire par étape
        </h3>
        <p className="mt-0.5 text-xs text-[#6b7280]">L'ouvrier voit cet objectif après avoir scanné le QR de son poste.</p>
        <div className="mt-3 space-y-2">
          {ETAPES_A1_GAMME.map((def) => {
            const s = steps.find((x: any) => Number(x.step_order) === def.ordre);
            if (!s) return null;
            const fait = Number(s.quantity_ok) || 0;
            const obj = objectifs[s.id] ?? 0;
            const pct = obj > 0 ? Math.min(100, Math.round((fait / obj) * 100)) : 0;
            return (
              <div key={s.id} className="rounded-xl border border-black/[0.05] p-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#c24a08]/10 text-sm">{def.icone}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-[#1a1d23]">{def.ordre}. {def.nom}</span>
                    <span className="block text-[11px] text-[#9ca3af]">Fait : {fait} / Objectif : {obj} {obj > 0 && `· ${pct}%`}</span>
                  </span>
                  <input type="number" min={0} value={obj}
                    onChange={(e) => setObjectifs((prev) => ({ ...prev, [s.id]: Math.max(0, Number(e.target.value)) }))}
                    className="w-20 rounded-lg border border-black/[0.08] bg-white px-2 py-1.5 text-center text-sm font-black text-[#1a1d23] focus:outline-none focus:ring-2 focus:ring-[#c24a08]/20" />
                  <button disabled={busy} onClick={() => sauverObjectif(s.id)}
                    className="rounded-lg bg-[#c24a08] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40">
                    {busy ? <Loader2 size={13} className="animate-spin" /> : "OK"}
                  </button>
                </div>
                {obj > 0 && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/[0.05]">
                    <div className="h-full rounded-full bg-[#c24a08] transition-all" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── QR à imprimer ── */}
      <QrEtapes etapes={etapesQR} orderNumber={order.order_number} />

      {/* ── Résumé réussi / perdu ── */}
      <div className="card p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#9ca3af]">Bilan déclaré par les ouvriers</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {steps
            .slice()
            .sort((a: any, b: any) => Number(a.step_order) - Number(b.step_order))
            .map((s: any) => (
              <div key={s.id} className="rounded-xl bg-black/[0.02] p-3 text-center">
                <p className="text-xs font-black text-[#1a1d23]">{s.step_order}. {s.step_name}</p>
                <p className="mt-1 text-sm font-black text-[#4a7c59]">✅ {Number(s.quantity_ok) || 0}</p>
                <p className="text-[11px] font-bold text-[#9ca3af]">
                  {s.status === "DONE" ? "Terminée" : s.status === "ACTIVE" ? "▶️ En cours" : "⏳ En attente"}
                </p>
              </div>
            ))}
        </div>
        <p className="mt-2 flex items-center gap-1 text-xs text-[#9ca3af]">
          <CheckCircle2 size={12} /> Le perdu est tracé dans les journaux matière (material_logs).
        </p>
      </div>
    </div>
  );
}
