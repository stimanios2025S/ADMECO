"use client";
import { useEffect, useRef, useState } from "react";
import { cueScan } from "@/lib/audio/cues";

export default function Scanner({ onScan, paused }: { onScan: (text: string) => void; paused?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState("");
  const [manual, setManual] = useState("");
  const scannerRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!mounted || !ref.current) return;
        const id = "mes-qr-reader";
        if (!document.getElementById(id)) {
          const d = document.createElement("div");
          d.id = id;
          ref.current.appendChild(d);
        }
        const qr = new Html5Qrcode(id);
        scannerRef.current = qr;
        await qr.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 280, height: 280 } },
          (text: string) => { cueScan(); onScan(text); },
          () => {}
        );
      } catch (e: any) {
        setErr("Camera unavailable — use manual entry below.");
      }
    })();
    return () => { mounted = false; try { scannerRef.current?.stop(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (paused) { try { scannerRef.current?.pause(); } catch {} }
    else { try { scannerRef.current?.resume(); } catch {} }
  }, [paused]);

  return (
    <div className="space-y-3">
      <div ref={ref} className="overflow-hidden rounded-2xl bg-black min-h-[280px]" />
      {err && <p className="text-amber-300 text-sm">{err}</p>}
      <form
        className="flex gap-2"
        onSubmit={(e) => { e.preventDefault(); if (manual.trim()) onScan(manual.trim()); setManual(""); }}
      >
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Manual code entry (e.g. MNF-AB12CD)"
          className="flex-1 rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-3 text-lg text-white"
        />
        <button className="rounded-xl bg-yellow-400 px-5 font-bold text-black text-lg">GO</button>
      </form>
    </div>
  );
}
