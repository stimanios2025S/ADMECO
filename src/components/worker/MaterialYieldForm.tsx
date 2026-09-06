"use client";
import { useState } from "react";
import { scrapPct, yieldCoeff } from "@/lib/calc/yield";
import { cueScrapAlert } from "@/lib/audio/cues";

export type YieldInput = {
  materialName: string; qtyUsed: number; qtyLost: number;
  goodUnits: number; scrapUnits: number; expectedUnits: number; lossReason: string;
};

export default function MaterialYieldForm({
  standardMaterial, standardQty, expectedUnits, onSubmit
}: {
  standardMaterial: string; standardQty: number; expectedUnits: number;
  onSubmit: (v: YieldInput) => void;
}) {
  const [f, setF] = useState<YieldInput>({
    materialName: standardMaterial, qtyUsed: standardQty, qtyLost: 0,
    goodUnits: expectedUnits, scrapUnits: 0, expectedUnits, lossReason: ""
  });
  const set = (k: keyof YieldInput, v: any) => setF((p) => ({ ...p, [k]: v }));
  const sp = scrapPct(f.goodUnits, f.scrapUnits);
  const yc = yieldCoeff(f.goodUnits, f.expectedUnits);

  return (
    <form
      className="space-y-3 rounded-2xl bg-zinc-900 border border-zinc-700 p-4 text-white"
      onSubmit={(e) => { e.preventDefault(); if (sp > 5) cueScrapAlert(); onSubmit(f); }}
    >
      <div className="font-black text-xl">📦 Material & Yield logging</div>
      <label className="block">Material
        <input value={f.materialName} onChange={(e) => set("materialName", e.target.value)}
          className="mt-1 w-full rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-3 text-lg" required />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">Used
          <input type="number" step="any" min={0} value={f.qtyUsed} onChange={(e) => set("qtyUsed", Number(e.target.value))}
            className="mt-1 w-full rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-3 text-lg" required />
        </label>
        <label className="block">Lost
          <input type="number" step="any" min={0} value={f.qtyLost} onChange={(e) => set("qtyLost", Number(e.target.value))}
            className="mt-1 w-full rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-3 text-lg" required />
        </label>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <label className="block">Good ✅
          <input type="number" min={0} value={f.goodUnits} onChange={(e) => set("goodUnits", Number(e.target.value))}
            className="mt-1 w-full rounded-xl bg-emerald-950 border border-emerald-700 px-4 py-3 text-lg" required />
        </label>
        <label className="block">Scrap 🗑️
          <input type="number" min={0} value={f.scrapUnits} onChange={(e) => set("scrapUnits", Number(e.target.value))}
            className="mt-1 w-full rounded-xl bg-red-950 border border-red-700 px-4 py-3 text-lg" required />
        </label>
        <label className="block">Expected
          <input type="number" min={0} value={f.expectedUnits} onChange={(e) => set("expectedUnits", Number(e.target.value))}
            className="mt-1 w-full rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-3 text-lg" required />
        </label>
      </div>
      {f.qtyLost > 0 && (
        <label className="block">Loss reason
          <input value={f.lossReason} onChange={(e) => set("lossReason", e.target.value)} placeholder="e.g. cracked board, weld defect"
            className="mt-1 w-full rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-3 text-lg" />
        </label>
      )}
      <div className="flex gap-2 text-sm">
        <span className={`rounded-lg px-3 py-1 font-bold ${sp > 5 ? "bg-red-600" : "bg-zinc-700"}`}>
          Scrap {sp.toFixed(1)}% {sp > 5 ? "⚠️ ALERT" : ""}
        </span>
        <span className="rounded-lg px-3 py-1 bg-zinc-700 font-bold">Yield {(yc * 100).toFixed(1)}%</span>
      </div>
      <button className="w-full rounded-2xl bg-yellow-400 py-4 text-xl font-black text-black">
        ✅ COMPLETE STEP
      </button>
    </form>
  );
}
