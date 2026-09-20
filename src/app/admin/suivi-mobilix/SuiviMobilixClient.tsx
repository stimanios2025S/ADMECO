"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sofa, Play, CheckCircle2, Clock, Loader2, Package } from "lucide-react";
import { lancerSuiviMobilix } from "@/app/actions-usines";
import { ETAPES_MOBILIX, MODELES_MOBILIX, ordreMobilixCourt, type ModeleMobilix } from "@/lib/process-mobilix";
import { cn } from "@/lib/utils";

type Props = { usine: string; orders: any[]; items: any[]; steps: any[] };

export default function SuiviMobilixClient({ usine, orders, items, steps }: Props) {
  const router = useRouter();
  const [modele, setModele] = useState<ModeleMobilix>("G21");
  const [numero, setNumero] = useState("");
  const [qty, setQty] = useState(10);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [ouvert, setOuvert] = useState<string | null>(null);

  const stepsParItem = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const s of steps) {
      const k = String(s.item_id);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(s);
    }
    return m;
  }, [steps]);

  const lancer = async () => {
    setBusy(true);
    setMsg("");
    const r = await lancerSuiviMobilix({ orderNumber: numero.trim(), modele, quantity: qty });
    setMsg(r.ok ? `✅ ${r.message}` : `❌ ${r.message}`);
    if (r.ok) { setNumero(""); router.refresh(); }
    setBusy(false);
  };

  const infoModele = MODELES_MOBILIX.find((m) => m.code === modele)!;

  return (
    <div className="stagger space-y-5">
      {msg && (
        <div className={cn("rounded-2xl border p-4 text-sm font-bold shadow-sm", msg.startsWith("✅") ? "border-[#4a7c59]/20 bg-[#4a7c59]/[0.06] text-[#4a7c59]" : "border-red-200 bg-red-50 text-red-600")}>
          {msg}
        </div>
      )}

      {/* ── Lancement ── */}
      <div className="card p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#9ca3af]">Lancer un suivi</p>
        <h2 className="mt-1 text-xl font-black tracking-tight text-[#1a1d23]">
          <Sofa size={18} className="mr-1 inline text-[#7c3aed]" /> Nouvelle production MOBILIX
        </h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {MODELES_MOBILIX.map((m) => (
            <button key={m.code} onClick={() => setModele(m.code)}
              className={cn("rounded-2xl border p-4 text-left transition-all",
                modele === m.code ? "border-[#7c3aed]/40 bg-[#7c3aed]/[0.05] shadow-sm" : "border-black/[0.06] hover:border-black/[0.12]")}>
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-black",
                modele === m.code ? "bg-[#7c3aed] text-white" : "bg-black/[0.05] text-[#9ca3af]")}>{m.code}</span>
              <span className="mt-2 block text-sm font-black text-[#1a1d23]">{m.nom}</span>
              <span className="mt-0.5 block text-xs text-[#6b7280]">{m.detail}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input value={numero} onChange={(e) => setNumero(e.target.value)}
            placeholder={`N° suivi (ex. MBX-${new Date().getFullYear()}-001)`}
            className="flex-1 rounded-xl border border-black/[0.08] bg-white px-4 py-3 text-sm font-bold text-[#1a1d23] placeholder:font-normal placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/20" />
          <div className="flex items-center gap-2 rounded-xl border border-black/[0.08] bg-white px-4 py-3">
            <Package size={15} className="text-[#9ca3af]" />
            <input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
              className="w-20 bg-transparent text-sm font-black text-[#1a1d23] focus:outline-none" />
            <span className="text-xs font-bold text-[#9ca3af]">chaises</span>
          </div>
          <button disabled={busy || !numero.trim()} onClick={lancer}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#7c3aed] px-6 py-3 text-sm font-bold text-white disabled:opacity-40 transition-opacity">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Lancer · 19 étapes
          </button>
        </div>
        <p className="mt-2 text-xs text-[#9ca3af]">
          Crée la commande ({infoModele.inserts} par chaise) + les 19 étapes M1 avec QR : coupe → traçage → couture A→H (8 QR) → contrôle → bois → inserts → rembourrage → {infoModele.etape10.toLowerCase()} → assemblage → emballage.
        </p>
      </div>

      {/* ── Gamme de référence ── */}
      <div className="card p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#9ca3af]">Gamme officielle · 12 postes · 19 QR</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {ETAPES_MOBILIX.map((e) => (
            <span key={e.code} title={`${e.nom} — ${e.consigne}`}
              className="inline-flex items-center gap-1 rounded-lg bg-black/[0.03] px-2 py-1 text-[11px] font-bold text-[#6b7280]">
              {e.icone} {ordreMobilixCourt(e.ordre)} · {e.nom}
            </span>
          ))}
        </div>
      </div>

      {/* ── Suivis en cours ── */}
      <div className="card p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#9ca3af]">
          Suivis MOBILIX · {orders.length}
        </p>
        {orders.length === 0 ? (
          <p className="mt-3 rounded-xl bg-black/[0.02] p-6 text-center text-sm font-bold text-[#9ca3af]">
            Aucun suivi lancé — créez le premier ci-dessus.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {orders.map((o: any) => {
              const oItems = items.filter((i: any) => i.order_id === o.id);
              const oSteps = oItems.flatMap((i: any) => stepsParItem.get(String(i.id)) ?? []);
              const done = oSteps.filter((s: any) => s.status === "DONE").length;
              const actif = oSteps.filter((s: any) => s.status === "ACTIVE").length;
              const pct = oSteps.length > 0 ? Math.round((done / oSteps.length) * 100) : 0;
              const isOpen = ouvert === o.id;
              return (
                <div key={o.id} className="rounded-2xl border border-black/[0.05] bg-white">
                  <button onClick={() => setOuvert(isOpen ? null : o.id)}
                    className="flex w-full items-center gap-3 p-4 text-left">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#7c3aed]/10 text-lg">🪑</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-[#1a1d23]">{o.order_number}</span>
                      <span className="block text-xs text-[#9ca3af]">
                        {oItems.map((i: any) => i.product_name).join(", ") || "—"} · {done}/{oSteps.length} postes · {pct}%
                      </span>
                      <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-black/[0.05]">
                        <span className="block h-full rounded-full bg-[#7c3aed] transition-all" style={{ width: `${pct}%` }} />
                      </span>
                    </span>
                    {actif > 0 && (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#7c3aed]/10 px-2 py-1 text-[10px] font-black text-[#7c3aed]">
                        <Clock size={10} /> {actif} en cours
                      </span>
                    )}
                    {pct === 100 && oSteps.length > 0 && (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#4a7c59]/10 px-2 py-1 text-[10px] font-black text-[#4a7c59]">
                        <CheckCircle2 size={10} /> Terminé
                      </span>
                    )}
                  </button>
                  {isOpen && (
                    <div className="border-t border-black/[0.04] p-4">
                      <div className="space-y-1">
                        {oSteps.map((s: any) => (
                          <div key={s.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px]"
                            style={s.status === "DONE" ? { background: "rgba(74,124,89,.06)" } : s.status === "ACTIVE" ? { background: "rgba(124,58,237,.06)" } : undefined}>
                            <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-md text-[11px] font-black text-white",
                              s.status === "DONE" ? "bg-[#4a7c59]" : s.status === "ACTIVE" ? "bg-[#7c3aed]" : "bg-black/20")}>
                              {ordreMobilixCourt(Number(s.step_order))}
                            </span>
                            <span className="min-w-0 flex-1 truncate font-bold text-[#1a1d23]">{s.step_name}</span>
                            {s.quantity_ok > 0 && <span className="text-xs font-bold text-[#4a7c59]">OK {s.quantity_ok}</span>}
                            <span className="text-[11px] font-bold text-[#9ca3af]">
                              {s.status === "DONE" ? "✅" : s.status === "ACTIVE" ? "▶️ En cours" : "⏳"}
                            </span>
                          </div>
                        ))}
                        {oSteps.length === 0 && (
                          <p className="text-xs font-bold text-[#9ca3af]">Étapes non chargées (migration 0012 requise côté serveur).</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-3 text-[11px] text-[#9ca3af]">
          Usine connectée : <b>{usine}</b> · Les ouvriers déclarent depuis{" "}
          <Link href="/atelier/m1" className="font-mono font-bold text-[#7c3aed] hover:underline">
            /atelier/m1
          </Link>{" "}
          et{" "}
          <Link href="/atelier/m2" className="font-mono font-bold text-[#c026d3] hover:underline">
            /atelier/m2
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
