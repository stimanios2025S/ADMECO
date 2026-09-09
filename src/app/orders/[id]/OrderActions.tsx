"use client";
import { useState } from "react";
import { Truck } from "lucide-react";
import { createTransfer } from "@/app/actions";

export default function OrderActions({ orderId }: { orderId: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        const count = Number(prompt("Combien de bons articles dans ce bordereau palette ?", "50") ?? "0");
        if (!count) return;
        setBusy(true);
        try { await createTransfer(orderId, 1, 2, count); alert("Bordereau généré ✅"); location.reload(); }
        catch (e: any) { alert(e.message); }
        setBusy(false);
      }}
      className="btn-fire inline-flex items-center gap-1.5 px-4 py-2 text-sm"
    >
      <Truck size={16} /> {busy ? "Génération…" : "Bordereau palette (A1→A2)"}
    </button>
  );
}
