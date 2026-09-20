import { createServerSupabase } from "@/lib/supabase/server";
import { urlAtelier } from "@/lib/portail-atelier";

export type Role = "ADMIN" | "WORKER" | "MAGASINIER";

export type Profil = {
  id: string;
  email: string | null;
  role: Role;
  atelier_id: number | null;
  usine_code: "ADMEDCO" | "MOBILIX";
  full_name: string | null;
};

const normaliserRole = (role: unknown): Role =>
  role === "ADMIN" || role === "MAGASINIER" ? role : "WORKER";

const normaliserUsine = (usine: unknown): "ADMEDCO" | "MOBILIX" =>
  usine === "MOBILIX" ? "MOBILIX" : "ADMEDCO";

/**
 * Profil de l'utilisateur connecté (côté serveur).
 * Toujours résolu : champs manquants complétés par défaut
 * (rôle « WORKER », usine « ADMEDCO »).
 * Si personne n'est connecté, retourne un profil sentinelle
 * reconnaissable à `email: null`.
 */
export async function getProfil(): Promise<Profil> {
  const deconnecte: Profil = {
    id: "",
    email: null,
    role: "WORKER",
    atelier_id: null,
    usine_code: "ADMEDCO",
    full_name: null,
  };

  const supabase: any = createServerSupabase();
  const { data } = await supabase.auth.getUser();
  const user = (data as any)?.user;
  if (!user) return deconnecte;

  const { data: p } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!p) return { ...deconnecte, id: user.id, email: user.email ?? null };

  return {
    id: (p as any).id ?? user.id,
    email: user.email ?? null,
    role: normaliserRole((p as any).role),
    atelier_id: (p as any).atelier_id ?? null,
    usine_code: normaliserUsine((p as any).usine_code),
    full_name: (p as any).full_name ?? null,
  };
}

/**
 * Destination après connexion.
 *
 * Trois métiers, trois espaces — et un seul endroit qui en décide :
 *
 *   ADMIN      → le centre de commande
 *   MAGASINIER → la Réception matière première
 *   WORKER     → SON atelier. Pas « le portail » : son atelier.
 *                Un ouvrier qui doit choisir son poste à chaque
 *                connexion finit par se tromper de file, et le travail
 *                du voisin apparaît chez lui.
 *
 * Un ouvrier sans affectation n'a pas d'atelier où aller : on le
 * renvoie vers le hall, qui explique quoi faire. On ne devine jamais
 * un atelier par défaut — une pièce déclarée au mauvais poste est
 * plus coûteuse à réparer qu'un écran de plus à passer.
 */
export function routeApresLogin(profil: Profil): string {
  if (profil.role === "ADMIN") return "/admin";
  if (profil.role === "MAGASINIER") return "/admin/reception";
  return urlAtelier(profil.atelier_id); // « /atelier » si le poste n'est pas renseigné
}

const ROUTES_MAGASINIER = ["/admin/stocks", "/admin/reception", "/admin/depots"];
/**
 * Indique si un profil peut voir une page d'administration.
 * ADMIN : tout /admin. MAGASINIER : uniquement Stocks, Réception MP et Dépôts.
 */
export function peutVoirAdmin(profil: Profil | null, path: string): boolean {
  if (!profil) return false;
  if (profil.role === "ADMIN") return true;
  if (profil.role === "MAGASINIER") {
    return ROUTES_MAGASINIER.some(
      (route) => path === route || path.startsWith(route + "/")
    );
  }
  return false;
}

/** Dépôt Matière Première selon l'usine. */
export const depotMP = (usineCode: string) =>
  usineCode === "MOBILIX" ? "DEP-MP-MBX" : "DEP-MP";

/** Dépôts rattachés à une usine (filtre de scoping). */
export const depotsUsine = (usineCode: string): string[] =>
  usineCode === "MOBILIX" ? ["DEP-MP-MBX", "DEP-M1"] : ["DEP-MP", "DEP-A1", "DEP-A2"];
