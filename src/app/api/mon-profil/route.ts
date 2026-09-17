import { NextResponse } from "next/server";
import { getProfil } from "@/lib/auth";

/** Profil de l'utilisateur connecté (utilisé par le portail pour l'auto-routage). */
export async function GET() {
  const profil = await getProfil();
  if (!profil.email) {
    return NextResponse.json({ erreur: "Non connecté" }, { status: 401 });
  }
  return NextResponse.json(profil);
}
