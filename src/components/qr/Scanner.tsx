"use client";
import { useEffect, useRef, useState } from "react";
import { cueScan } from "@/lib/audio/cues";
import { Camera, Keyboard } from "lucide-react";

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
        setErr("Caméra indisponible — utilisez la saisie manuelle ci-dessous.");
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
      <div ref={ref} className="overflow-hidden rounded-2xl bg-[#1a1d23] min-h-[280px]">
        {/* Scanner mounts here */}
      </div>
      {err && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
          <Camera size={16} className="shrink-0" />
          {err}
        </div>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => { e.preventDefault(); if (manual.trim()) onScan(manual.trim()); setManual(""); }}>
        <div className="relative flex-1">
          <Keyboard size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="Saisie manuelle (ex. MNF-AB12CD)"
            className="w-full rounded-xl border border-black/[0.08] bg-white pl-9 pr-4 py-3 text-[15px] text-[#1a1d23] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#4a7c59]/20 transition-shadow"
          />
        </div>
        <button className="rounded-xl bg-[#4a7c59] px-5 py-3 text-[15px] font-bold text-white hover:bg-[#3d6a4a] transition-colors">
          OK
        </button>
      </form>
    </div>
  );
}
