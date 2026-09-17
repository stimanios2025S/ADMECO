import { redirect } from "next/navigation";
import { getProfil, routeApresLogin } from "@/lib/auth";

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
