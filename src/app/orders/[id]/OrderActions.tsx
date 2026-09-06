"use client";
import { useState } from "react";
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
      className="rounded-xl bg-yellow-400 px-5 py-2.5 font-black text-black"
    >
      🚚 Generate pallet manifest (A2→B3)
    </button>
  );
}
