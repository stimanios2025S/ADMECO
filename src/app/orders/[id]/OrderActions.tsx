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
        const count = Number(prompt("How many good items in this pallet manifest?", "50") ?? "0");
        if (!count) return;
        setBusy(true);
        try { await createTransfer(orderId, 2, 3, count); alert("Manifest generated ✅"); location.reload(); }
        catch (e: any) { alert(e.message); }
        setBusy(false);
      }}
      className="btn-fire inline-flex items-center gap-1.5 px-4 py-2 text-sm"
    >
      <Truck size={16} /> {busy ? "Generating…" : "Pallet manifest (A2→B3)"}
    </button>
  );
}
