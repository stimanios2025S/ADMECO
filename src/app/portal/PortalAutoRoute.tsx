"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ATELIERS, atelierUsine, type AtelierId } from "@/lib/ateliers";

type ProfilApi = {
  id: string;
  email: string | null;
  role: string;
  atelier_id: number | null;
  usine_code: "ADMEDCO" | "MOBILIX";
};

/**
 * Auto-routage du portail ouvrier :
 * - non connecté → /portail (connexion portail)
 * - ADMIN/MAGASINIER → /redirection (vers /admin ou /admin/reception)
 * - WORKER → son atelier (profil.atelier_id) ; garde-fou anti-usine croisée :
 *   un ouvrier ADMEDCO ne peut pas ouvrir l'atelier MOBILIX (et inversement).
 */
export default function PortalAutoRoute({ atelierDemande }: { atelierDemande: AtelierId | null }) {
  const router = useRouter();
  const params = useSearchParams();
  const [blocage, setBlocage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      let profil: ProfilApi | null = null;
      try {
        const r = await fetch("/api/mon-profil", { cache: "no-store" });
        if (r.ok) profil = (await r.json()) as ProfilApi;
      } catch {
        profil = null;
      }
      if (!profil?.email) {
        router.replace("/portail");
        return;
      }
      if (profil.role === "ADMIN" || profil.role === "MAGASINIER") {
        router.replace("/redirection");
        return;
      }
      // WORKER : forcer son atelier si l'URL n'en précise pas.
      // Validé contre la liste réelle des ateliers : une liste écrite à la
      // main avait déjà manqué l'Atelier 3 (id 4) à sa création.
      const atelierProfil = ATELIERS.some((a) => a.id === profil.atelier_id)
        ? (profil.atelier_id as AtelierId)
        : null;
      if (!atelierDemande && atelierProfil) {
        const q = new URLSearchParams(params?.toString() ?? "");
        q.set("atelier", String(atelierProfil));
        router.replace(`/portal?${q.toString()}`);
        return;
      }
      // Garde-fou anti-mélange des usines
      if (atelierDemande && atelierProfil && atelierDemande !== atelierProfil) {
        const usineDemandee = atelierUsine(atelierDemande);
        const usineProfil = atelierUsine(atelierProfil);
        if (usineDemandee !== usineProfil) {
          setBlocage(
            `⛔ Ce portail est l'Atelier ${atelierDemande} (${usineDemandee}) — votre compte est rattaché à l'Atelier ${atelierProfil} (${usineProfil}). Demandez à l'admin de changer votre affectation.`
          );
        }
      }
    })();
  }, [atelierDemande, router, params]);

  if (blocage) {
    return (
      <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700 shadow-sm">
        {blocage}
      </div>
    );
  }
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-40 hidden items-center gap-2 rounded-full border border-black/[0.06] bg-white/90 px-3 py-1.5 text-[11px] font-bold text-[#9ca3af] shadow-sm">
      <Loader2 size={11} className="animate-spin" /> Vérification du poste…
    </div>
  );
}
