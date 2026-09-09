"use client";
import { useState } from "react";
import { splitBatch } from "@/app/actions";

export default function BatchSplitDialog({ stepId, expected }: { stepId: string; expected: number }) {
  const [open, setOpen] = useState(false);
  const [damaged, setDamaged] = useState(2);
  const [busy, setBusy] = useState(false);
  if (!open) return <button onClick={() => setOpen(true)} className="rounded-xl bg-orange-600 px-4 py-2 font-bold text-white">✂️ Fractionner le lot</button>;
  return (
    <div className="rounded-2xl bg-orange-950 border border-orange-600 p-4 text-white space-y-2">
      <div className="font-bold">Fractionner le lot : marquer endommagé → pousser le reste</div>
      <div className="flex gap-2 items-center">
        <input type="number" min={1} max={expected} value={damaged} onChange={(e) => setDamaged(Number(e.target.value))}
          className="w-24 rounded-xl bg-zinc-800 border px-3 py-2" />
        <span className="text-sm">endommagés / à reprendre sur {expected}</span>
      </div>
      <div className="flex gap-2">
        <button disabled={busy} onClick={async () => { setBusy(true); await splitBatch(stepId, damaged); setBusy(false); }}
          className="rounded-xl bg-orange-500 px-4 py-2 font-bold text-black">Confirmer ({expected - damaged} → suivant)</button>
        <button onClick={() => setOpen(false)} className="rounded-xl bg-zinc-700 px-4 py-2">Annuler</button>
      </div>
    </div>
  );
}
