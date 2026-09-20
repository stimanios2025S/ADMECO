import { redirect } from "next/navigation";
import { atelierDuSlug, slugAtelier } from "@/lib/portail-atelier";

export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════
// /portal — L'ANCIENNE ADRESSE, QUI CONTINUE DE MENER QUELQUE PART
//
// ── Pourquoi cette page existe encore ──
// Le scan des QR vivait ici. Il vit maintenant SOUS l'atelier :
//
//   /portal?atelier=1&etape=3   →   /atelier/a1/scan?etape=3
//
// Cette page ne fait plus rien d'autre que traduire l'ancienne
// adresse. Elle n'affiche ni écran, ni formulaire, ni caméra : c'est
// une redirection, pas un portail. La supprimer franchement laisserait
// un 404 à quiconque a l'habitude de taper `/portal` — et, dans une
// usine, une adresse qui marchait hier et qui casse aujourd'hui passe
// pour une panne du système, pas pour un changement d'URL.
//
// ── Le piège des ids ──
// `?atelier=` porte un id TECHNIQUE (A3 = 4, M1 = 3). La traduction
// vers un slug passe par `slugAtelier`, jamais par un calcul — la
// règle est posée dans lib/portail-atelier.ts.
// ═══════════════════════════════════════════════════════════

export default function AncienPortal({
  searchParams,
}: {
  searchParams?: { atelier?: string; etape?: string };
}) {
  const slugDirect = atelierDuSlug(searchParams?.atelier ?? "");
  const depuisId = Number(searchParams?.atelier);
  const slug = slugDirect
    ? slugAtelier(slugDirect)
    : [1, 2, 3, 4, 5].includes(depuisId)
      ? slugAtelier(depuisId)
      : null;

  // Une étape précise : c'était une demande de scan. On la porte au
  // même endroit dans la nouvelle arborescence.
  const etape = Number(searchParams?.etape);
  if (slug && Number.isFinite(etape) && etape >= 1 && etape <= 30) {
    redirect(`/atelier/${slug}/scan?etape=${etape}`);
  }

  // Un atelier sans étape : la file de travail.
  if (slug) redirect(`/atelier/${slug}`);

  // Rien du tout : l'entrée des deux usines.
  redirect("/portail");
}
