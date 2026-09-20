"use client";
import { useEffect, useRef, useState } from "react";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import { useRealtimeSteps } from "@/hooks/useRealtimeSteps";
import { useMes } from "@/lib/store/mes-store";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";

/** Diffuse un rafraîchissement local (files d'ateliers, compteurs) sur la tablette. */
export function signalerSync() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("mes-sync"));
}

/**
 * Socle de synchronisation des portails : monte la file hors-ligne
 * (état connexion + vidage auto au retour réseau), écoute le temps réel
 * Supabase et rediffuse chaque changement aux files d'ateliers.
 */
export default function PortalSync() {
  const { online, drain, refresh } = useOfflineQueue();
  const tick = useRealtimeSteps();
  const queueCount = useMes((s) => s.queueCount);
  const [sync, setSync] = useState(false);
  const premier = useRef(true);

  // Chaque événement temps réel → recharger les files affichées
  useEffect(() => {
    if (premier.current) { premier.current = false; return; }
    signalerSync();
    void refresh();
  }, [tick, refresh]);

  const forcer = async () => {
    setSync(true);
    try {
      await drain();
      await refresh();
      signalerSync();
    } finally {
      setSync(false);
    }
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-black/[0.04] bg-white px-4 py-2.5 shadow-sm">
      <span className={`grid h-9 w-9 place-items-center rounded-xl ${online ? "bg-[#4a7c59]/10 text-[#4a7c59]" : "bg-red-50 text-red-400"}`}>
        {online ? <Wifi size={17} /> : <WifiOff size={17} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#9ca3af]">Synchronisation</p>
        <p className="truncate text-sm font-bold text-[#1a1d23]">
          {online
            ? queueCount > 0
              ? `En ligne — ${queueCount} opération${queueCount > 1 ? "s" : ""} en attente`
              : "En ligne et synchronisé"
            : "Hors ligne — reprise auto au retour réseau"}
        </p>
      </div>
      <span className="flex items-center gap-1.5 rounded-full bg-[#4a7c59]/10 px-2.5 py-1 text-[10px] font-bold text-[#4a7c59]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#4a7c59] live-dot" />
        Temps réel actif
      </span>
      <button onClick={forcer} disabled={sync || !online}
        className="flex items-center gap-1.5 rounded-xl border border-black/[0.06] bg-black/[0.02] px-3.5 py-2 text-xs font-bold text-[#1a1d23] hover:bg-black/[0.04] disabled:opacity-40 transition-colors">
        <RefreshCw size={13} className={sync ? "animate-spin" : ""} />
        {sync ? "Synchro…" : "Synchroniser"}
      </button>
    </div>
  );
}
