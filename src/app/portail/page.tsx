import { redirect } from "next/navigation";

// ═══════════════════════════════════════════════════════════
// /portail — ANCIENNE PAGE DE CONNEXION DES ATELIERS
//
// ── Pourquoi elle est vide ──
// Elle faisait exactement ce que fait `/login` : un formulaire
// e-mail + mot de passe, puis une redirection. Deux formulaires
// identiques, c'est deux endroits où corriger un message d'erreur —
// et la preuve que ça dérive, c'est que les deux avaient DÉJÀ divergé :
// `/portail` envoyait vers `/portal?usine=…` pendant que `/login`
// décidait du rôle lui-même.
//
// ── Pourquoi elle n'est pas supprimée ──
// L'adresse a circulé : elle est peut-être épinglée sur une tablette
// d'atelier, ou notée quelque part. La casser enverrait un ouvrier sur
// une 404 un lundi matin. Elle redirige donc vers l'unique formulaire.
//
// La destination après connexion, elle, est décidée par le serveur
// seul (`routeApresLogin`, appelé depuis /redirection) : ADMIN au
// centre de commande, MAGASINIER à la réception, WORKER SUR SON
// ATELIER.
// ═══════════════════════════════════════════════════════════

export default function AncienPortail() {
  redirect("/login");
}
