"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { statutFr } from "@/lib/fr";
import { verifyTransfer } from "@/app/actions";

type Bordereau = { id: string; manifest_qr: string; item_count: number; status: string; created_at: string; work_orders?: { order_number: string } | null };

export default function Atelier2Tools() {
  const [bordereaux, setBordereaux] = useState<Bordereau[]>([]);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const charger = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("site_transfers")
      .select("id,manifest_qr,item_count,status,created_at,work_orders(order_number)")
      .order("created_at", { ascending: false }).limit(10);
    if (data) setBordereaux(data as any);
  };

  useEffect(() => { void charger(); }, []);

  const verifier = async (id: string) => {
    setBusy(id);
    try { await verifyTransfer(id, true); setMsg("✅ Bordereau vérifié — articles réceptionnés en Atelier 2"); await charger(); }
    catch (e: any) { setMsg(`❌ ${e.message}`); }
    setBusy(null);
  };

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="glass rounded-2xl p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Atelier 2 — Réception & finition</p>
        <p className="mt-2 text-xl font-black tracking-tight text-white">Assemblage, soudage, poudrage, montage</p>
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (code.trim()) { setMsg(`🔍 Recherche du bordereau ${code.trim()}…`); } }}>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Scanner ou saisir le bordereau (ex. MNF-AB12CD)"
            className="glass-input flex-1 px-3 py-2.5 text-sm" />
          <button className="btn-ghost px-4 py-2.5 text-sm font-bold">Vérifier</button>
        </form>
        {msg && <p className="mt-2 rounded-xl bg-white/5 px-3 py-2 text-sm font-bold text-zinc-100">{msg}</p>}
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-emerald-300">🔧 Assemblage</span>
          <span className="rounded-full bg-white/5 px-2.5 py-1 text-zinc-300">⚡ Soudage</span>
          <span className="rounded-full bg-white/5 px-2.5 py-1 text-zinc-300">🎨 Poudrage</span>
          <span className="rounded-full bg-white/5 px-2.5 py-1 text-zinc-300">🪑 Montage</span>
        </div>
      </div>
      <div className="glass rounded-2xl p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Bordereaux reçus · {bordereaux.length}</p>
        {bordereaux.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">Aucun bordereau — libérez des articles depuis une commande.</p>
        ) : (
          <div className="mt-2 space-y-1.5">
            {bordereaux.map((b) => (
              <div key={b.id} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm">
                <span className="font-mono font-bold text-emerald-300">{b.manifest_qr}</span>
                <span className="min-w-0 flex-1 truncate text-zinc-300">{b.work_orders?.order_number} · ×{b.item_count}</span>
                <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] font-bold text-zinc-200">{statutFr(b.status)}</span>
                {b.status === "PENDING" && (
                  <button disabled={busy === b.id} onClick={() => verifier(b.id)}
                    className="rounded-lg bg-emerald-500 px-2.5 py-1 text-[12px] font-black text-black disabled:opacity-40">
                    {busy === b.id ? "…" : "Réceptionner"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
