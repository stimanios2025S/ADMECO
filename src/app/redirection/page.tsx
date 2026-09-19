import { redirect } from "next/navigation";
import { getProfil, routeApresLogin } from "@/lib/auth";

// Cette page lit la session : elle est propre à CHAQUE visiteur et
// ne peut pas être pré-rendue. Sans ce drapeau, `next build` tente de
// la générer à la compilation, y appelle Supabase, et échoue dès que
// les variables d'environnement ne sont pas présentes dans la machine
// qui construit — alors que le serveur, lui, les a.
export const dynamic = "force-dynamic";

/** Aiguille chaque utilisateur connecté vers son espace selon son rôle et son usine. */
export default async function PageRedirection() {
  const profil = await getProfil();
  if (!profil.email) redirect("/login");

  const destination = routeApresLogin(profil);
  if (profil.role === "WORKER") {
    redirect(`${destination}?usine=${profil.usine_code}`);
  }
  redirect(destination);
}
