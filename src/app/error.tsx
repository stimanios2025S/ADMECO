"use client";
import { useEffect } from "react";
import Link from "next/link";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("[RootError]", error); }, [error]);
  return (
    <div className="grid min-h-screen place-items-center bg-[#f3f0eb] p-6">
      <div className="w-full max-w-md space-y-3 rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
        <p className="text-4xl">⚠️</p>
        <p className="text-lg font-black text-[#1a1d23]">Une erreur est survenue</p>
        <p className="rounded-xl bg-red-50 px-3 py-2 text-left font-mono text-xs text-red-500">{error.message}</p>
        {error.digest && <p className="font-mono text-[11px] text-[#7c8091]">référence : {error.digest} — retrouvez-la dans Vercel → Journaux</p>}
        <div className="flex justify-center gap-2 pt-1">
          <button onClick={reset} className="rounded-xl bg-[#4a7c59] px-4 py-2 text-sm font-bold text-white">Réessayer</button>
          <Link href="/admin" className="rounded-xl border border-black/10 px-4 py-2 text-sm font-bold text-[#1a1d23]">Retour au tableau de bord</Link>
        </div>
      </div>
    </div>
  );
}
