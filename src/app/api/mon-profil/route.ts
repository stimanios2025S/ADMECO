import { NextResponse } from "next/server";
import { getProfil } from "@/lib/auth";

// Route de session : dépend du cookie de l'appelant, jamais d'un cache.
// `force-dynamic` évite que `next build` tente de la pré-générer et
// aille interroger Supabase sur la machine qui construit.
export const dynamic = "force-dynamic";

/** Profil de l'utilisateur connecté (utilisé par le portail pour l'auto-routage). */
export async function GET() {
  const profil = await getProfil();
  if (!profil.email) {
    return NextResponse.json({ erreur: "Non connecté" }, { status: 401 });
  }
  return NextResponse.json(profil);
}
