"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { manifestQrPayload } from "@/lib/qr/manifest";

export default function ManifestQrCard({ manifest, orderNumber, itemCount }: { manifest: string; orderNumber: string; itemCount: number }) {
  const [img, setImg] = useState("");
  useEffect(() => { QRCode.toDataURL(manifestQrPayload(manifest), { width: 300, margin: 1 }).then(setImg); }, [manifest]);
  return (
    <div className="rounded-2xl border-2 border-dashed border-yellow-400 bg-zinc-900 p-6 text-center text-white">
      <div className="text-sm text-zinc-400">PALLET MANIFEST — scan 1 code for all items</div>
      <div className="text-2xl font-black mt-1">{orderNumber} × {itemCount}</div>
      {img && <img src={img} alt="manifest qr" className="mx-auto my-3 rounded-lg bg-white p-2" />}
      <div className="font-mono text-yellow-300 text-lg">{manifest}</div>
      <button onClick={() => window.print()} className="mt-3 rounded-lg bg-yellow-400 text-black font-bold px-4 py-2 print:hidden">🖨️ Print manifest</button>
    </div>
  );
}
