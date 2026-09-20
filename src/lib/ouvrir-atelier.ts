// ═══════════════════════════════════════════════════════════
// OUVRIR UN ATELIER — sans identifiant, sans mot de passe
//
// ── Le parcours ──
// L'ouvrier clique « Ouvrir A1 ». La session est créée côté
// serveur, les cookies sont posés, et il atterrit sur sa file. Il
// ne tape rien.
//
// ── Pourquoi une session quand même ──
// On aurait pu supprimer l'authentification des écrans d'atelier.
// On ne l'a pas fait, pour trois raisons qui tiennent à la
// production, pas à la sécurité :
//
//   · `work_order_steps.worker_id` a besoin d'un auteur. Sans
//     session, la colonne se vide et plus personne ne sait qui a
//     déclaré une pièce.
//   · Les policies RLS filtrent par `auth.uid()` et par atelier.
//     Sans session, il faudrait passer la clé service_role dans
//     les écrans, c'est-à-dire ouvrir TOUTE la base — y compris
//     les prix et les clients — pour afficher une file de poste.
//   · `/admin` reste fermé : ces comptes sont WORKER, jamais ADMIN.
//
// Donc : une vraie session, mais personne ne la saisit.
//
// ── Le mot de passe existe, mais il n'est pour personne ──
// Supabase refuse de créer une session sans mot de passe. Il y en a
// donc un — dérivé par HMAC d'un secret déjà présent sur le serveur,
// jamais écrit dans le dépôt, jamais affiché, jamais transmis. Il
// n'est pas « caché » : il n'est pas une donnée du système, c'est un
// détail d'implémentation. Le changer est sans conséquence.
//
// Ce que ça protège réellement : rien de plus que la porte
// elle-même, qui est ouverte par conception. Ce qui protège la
// production, c'est que ces comptes ne peuvent PAS aller sur
// /admin — le rôle le leur interdit.
// ═══════════════════════════════════════════════════════════

import { createHmac } from "node:crypto";
import { createServiceSupabase } from "./supabase/service";
import { atelierDuSlug, ficheAtelier, type SlugAtelier } from "./portail-atelier";

/** L'identifiant technique de l'atelier, invisible de l'ouvrier. */
export const emailAtelier = (slug: SlugAtelier): string => `${slug}@admedco.ma`;

/**
 * Le mot de passe dérivé d'un atelier.
 *
 * ── Pourquoi dérivé et non stocké ──
 * Tiré au hasard, il faudrait le ranger quelque part — base, variable
 * d'environnement, fichier — donc le faire circuler. Dérivé d'un
 * secret qui est DÉJÀ sur le serveur, il n'existe nulle part : il se
 * recalcule. Aucun état à sauvegarder, aucune rotation à organiser.
 *
 * ── Ce que ça garantit, et ce que ça ne garantit pas ──
 * Deux serveurs partageant `SUPABASE_SERVICE_ROLE_KEY` calculent le
 * même mot de passe : c'est ce qu'on veut, la session doit marcher
 * après un redéploiement. En revanche, qui détient cette clé peut
 * ouvrir n'importe quel atelier — mais qui détient cette clé peut
 * déjà tout faire, alors le mot de passe n'ajoute aucune surface.
 *
 * `At1` en tête : Supabase exige une taille minimale, et un mot de
 * passe qui ne contient QUE des caractères base64url peut, par
 * malchance, n'avoir ni chiffre ni minuscule.
 */
const motDePasseAtelier = (slug: SlugAtelier): string | null => {
  const secret =
    process.env.ATELIER_SECRET?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) return null;

  const empreinte = createHmac("sha256", secret)
    .update(`atelier:${slug}`)
    .digest("base64url")
    .slice(0, 21);

  return `At1${empreinte}`;
};

/** Le nom affiché de l'équipe dans les tableaux de bord. */
const nomEquipe = (slug: SlugAtelier): string => {
  const f = ficheAtelier(atelierDuSlug(slug));
  return f ? `Équipe ${f.code} — ${f.court}` : `Équipe ${slug.toUpperCase()}`;
};

export type Ouverture =
  | { ok: true; email: string; motDePasse: string }
  | { ok: false; raison: string };

/**
 * Garantit que le compte de l'atelier existe, est confirmé, rattaché à
 * son poste, et que son mot de passe est celui que le serveur vient de
 * calculer. Idempotent : appelable à chaque clic.
 */
export async function ouvrirAtelier(slug: SlugAtelier): Promise<Ouverture> {
  const id = { a1: 1, a2: 2, a3: 4, m1: 3, m2: 5 }[slug];
  const fiche = ficheAtelier(id);
  if (!fiche) return { ok: false, raison: "atelier-inconnu" };

  const motDePasse = motDePasseAtelier(slug);
  if (!motDePasse) {
    return { ok: false, raison: "secret-manquant" };
  }

  const email = emailAtelier(slug);
  const nom = nomEquipe(slug);
  const admin = createServiceSupabase();

  // ── Le compte existe-t-il déjà ? ──
  // On balaie les pages : `listUsers` est paginé, et une usine qui
  // aurait plus de 200 comptes verrait les suivants invisibles.
  let userId: string | null = null;
  for (let page = 1; page <= 20 && !userId; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return { ok: false, raison: "lecture-comptes" };
    userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
    if (data.users.length < 200) break;
  }

  if (userId) {
    // Le mot de passe est repris à chaque ouverture : si le secret a
    // changé, l'ancien mot de passe ne vaut plus rien et le clic
    // échouerait sans que personne ne comprenne pourquoi.
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password: motDePasse,
      email_confirm: true,
    });
    if (error) return { ok: false, raison: "mot-de-passe" };
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: motDePasse,
      email_confirm: true, // aucun courriel : le compte sert tout de suite
      user_metadata: { full_name: nom, role: "WORKER" },
    });
    if (error) return { ok: false, raison: "creation" };
    userId = data.user?.id ?? null;
    if (!userId) return { ok: false, raison: "creation" };
  }

  // ── Le rattachement ──
  // `atelier_id` est ce qui décide OÙ l'ouvrier atterrit et CE QU'il
  // voit. C'est la colonne qui compte : sans elle, la session
  // s'ouvrirait sur un hall vide.
  const { error: eProfil } = await admin
    .from("profiles")
    .upsert(
      { id: userId, role: "WORKER", full_name: nom, atelier_id: id },
      { onConflict: "id" }
    );

  if (eProfil) return { ok: false, raison: "profil" };

  return { ok: true, email, motDePasse };
}
