"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Printer } from "lucide-react";
import { ecoQrPayload, ecoQrLabel } from "@/lib/process-eco";

type EtapeQR = {
  id: string;
  step_order: number;
  step_name: string;
  target_qty: number;
  qr_code_hash: string;
  orderNumber: string;
  status: string;
};

// Affiche les QR d'étape à imprimer et coller aux postes.
// Le QR contient : MES:STEP:<N° commande>:<ordre>:<hash>
// L'objectif du matin (target_qty) est lu depuis la base, pas encodé dans le QR.
export default function QrEtapes({ etapes, orderNumber }: { etapes: EtapeQR[]; orderNumber: string }) {
  const [images, setImages] = useState<Record<string, string>>({});

  useEffect(() => {
    let actif = true;
    (async () => {
      const out: Record<string, string> = {};
      for (const e of etapes) {
        if (!e.qr_code_hash) continue;
        try {
          out[e.id] = await QRCode.toDataURL(ecoQrPayload(orderNumber, Number(e.step_order), e.qr_code_hash), {
            width: 180,
            margin: 1,
          });
        } catch { /* QR ignoré */ }
      }
      if (actif) setImages(out);
    })();
    return () => { actif = false; };
  }, [etapes, orderNumber]);

  if (etapes.length === 0) return null;

  const imprimer = () => window.print();

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#9ca3af]">QR des postes</p>
          <h3 className="mt-1 text-lg font-black tracking-tight text-[#1a1d23]">
            🖨️ À imprimer — {orderNumber}
          </h3>
          <p className="mt-0.5 text-xs text-[#6b7280]">
            1 QR par étape, à coller au poste. L'ouvrier scanne → voit son objectif du matin → déclare réussi / perdu.
          </p>
        </div>
        <button onClick={imprimer}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-black/[0.06] bg-black/[0.02] px-3 py-2 text-xs font-bold text-[#6b7280] hover:text-[#1a1d23] transition-colors">
          <Printer size={14} /> Imprimer
        </button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 print:grid-cols-3">
        {etapes
          .slice()
          .sort((a, b) => Number(a.step_order) - Number(b.step_order))
          .map((e) => (
            <div key={e.id} className="rounded-2xl border border-black/[0.06] bg-white p-3 text-center break-inside-avoid">
              {images[e.id] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={images[e.id]} alt={`QR ${e.step_name}`} className="mx-auto h-32 w-32" />
              ) : (
                <div className="mx-auto grid h-32 w-32 place-items-center rounded-xl bg-black/[0.03] text-xs font-bold text-[#9ca3af]">
                  QR…
                </div>
              )}
              <p className="mt-2 text-[13px] font-black text-[#1a1d23]">{ecoQrLabel(Number(e.step_order))}</p>
              <p className="text-[11px] font-bold text-[#6b7280]">{e.step_name}</p>
              <p className="mt-1 inline-block rounded-full bg-[#c24a08]/10 px-2 py-0.5 text-[11px] font-black text-[#c24a08]">
                🎯 Objectif : {Number(e.target_qty) || 0}
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-[#9ca3af]">{orderNumber} · Étape {e.step_order}</p>
            </div>
          ))}
      </div>
    </div>
  );
}
