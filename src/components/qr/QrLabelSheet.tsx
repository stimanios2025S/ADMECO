"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { stepQrPayload } from "@/lib/qr/manifest";

export type Label = { orderNumber: string; stepOrder: number; stepName: string; hash: string };

export default function QrLabelSheet({ labels }: { labels: Label[] }) {
  const [imgs, setImgs] = useState<string[]>([]);
  useEffect(() => {
    (async () => {
      const out: string[] = [];
      for (const l of labels) out.push(await QRCode.toDataURL(stepQrPayload(l.orderNumber, l.stepOrder, l.hash), { width: 220, margin: 1 }));
      setImgs(out);
    })();
  }, [labels]);

  return (
    <div>
      <button onClick={() => window.print()} className="mb-4 rounded-lg bg-zinc-900 text-white px-4 py-2 print:hidden">
        🖨️ Print labels (PDF via print dialog)
      </button>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 print:grid-cols-3">
        {labels.map((l, i) => (
          <div key={l.hash} className="border rounded-xl p-3 text-center bg-white text-black break-inside-avoid">
            {imgs[i] && <img src={imgs[i]} alt="qr" className="mx-auto" />}
            <div className="font-bold text-sm mt-1">{l.orderNumber} — Step {l.stepOrder}</div>
            <div className="text-xs">{l.stepName}</div>
            <div className="font-mono text-[10px] mt-1">{l.hash}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
