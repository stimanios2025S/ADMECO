"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { statutFr } from "@/lib/fr";

type Etape = { id: string; step_order: number; step_name: string; status: string; estimated_minutes: number; work_order_items?: { product_name: string; quantity: number } | null };

export default function Atelier1Tools() {
  const [etapes, setEtapes] = useState<Etape[]>([]);
  const [charge, setCharge] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("work_order_steps")
        .select("id,step_order,step_name,status,estimated_minutes,work_order_items(product_name,quantity)")
        .eq("atelier_id", 1).neq("status", "DONE").order("step_order").limit(12);
      if (data) setEtapes(data as any);
      setCharge(false);
    })();
  }, []);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="glass rounded-2xl p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Atelier 1 — File découpe</p>
        <p className="mt-2 text-xl font-black tracking-tight text-white">Découpe, usinage, préparation</p>
        <p className="mt-1 text-sm text-zinc-400">Scannez un QR pour démarrer. Le poste est verrouillé sur l'Atelier 1 — les QR de l'Atelier 2 sont refusés.</p>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
          <span className="rounded-full bg-orange-500/15 px-2.5 py-1 text-orange-300">🪚 Découpe panneaux</span>
          <span className="rounded-full bg-white/5 px-2.5 py-1 text-zinc-300">⚙️ Usinage</span>
          <span className="rounded-full bg-white/5 px-2.5 py-1 text-zinc-300">🧱 Préparation</span>
        </div>
      </div>
      <div className="glass rounded-2xl p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">En attente Atelier 1 · {etapes.length}</p>
        {charge ? <p className="mt-2 text-sm text-zinc-400">Chargement…</p> : etapes.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">Aucune étape en attente — tout est découpé ✅</p>
        ) : (
          <div className="mt-2 space-y-1.5">
            {etapes.map((e) => (
              <div key={e.id} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm">
                <span className="font-mono font-bold text-orange-300">#{e.step_order}</span>
                <span className="min-w-0 flex-1 truncate font-bold text-white">{e.step_name}</span>
                <span className="hidden text-xs text-zinc-400 sm:block">{e.work_order_items?.product_name} ×{e.work_order_items?.quantity}</span>
                <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] font-bold text-zinc-200">{statutFr(e.status)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
