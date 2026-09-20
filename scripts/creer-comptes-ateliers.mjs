// ═══════════════════════════════════════════════════════════
// CRÉER LES COMPTES DES CINQ ATELIERS — hors application
//
// Usage (à la racine du projet, .env.local renseigné) :
//   node scripts/creer-comptes-ateliers.mjs
//   node scripts/creer-comptes-ateliers.mjs --reinitialiser
//   node scripts/creer-comptes-ateliers.mjs a1=MonMotDePasse
//   node scripts/creer-comptes-ateliers.mjs --domaine=mobilix.ma
//
// ── Pourquoi ce script existe ──
//
// Un mot de passe Supabase est haché (bcrypt) à l'écriture. Il n'est
// PAS relisible : ni par la clé anon, ni par la clé service_role, ni
// par l'écran /admin/team, ni par ce script. Personne ne peut donc
// « afficher les mots de passe existants » — on ne peut que les
// DÉFINIR. C'est ce que fait ce script.
//
// ── Le trou qu'il bouche ──
//
// `inviteMember` (src/app/actions.ts, ligne 233) appelle
// `admin.auth.admin.createUser({ email, email_confirm: true, ... })`
// SANS `password`. Le compte créé depuis /admin/team n'a donc aucun
// mot de passe : il ne peut pas se connecter par `signInWithPassword`,
// qui est le seul chemin d'entrée du portail d'atelier. Un ouvrier
// invité aujourd'hui recevrait un identifiant qui refuse son mot de
// passe, quel qu'il soit.
//
// Ce script crée les comptes COMPLETS — utilisateur + profil — en
// posant le mot de passe au moment de la création.
//
// ── Il ne détruit rien ──
//
//   · compte absent  → créé avec son mot de passe
//   · compte présent → mot de passe LAISSÉ INTACT, seul le profil
//                      (rôle, atelier, nom) est remis à jour
//
// Un mot de passe n'est réécrit que sur `--reinitialiser` explicite.
// Sans cette précaution, relancer le script le lendemain casserait
// les postes qui se sont déjà connectés.
// ═══════════════════════════════════════════════════════════

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

// ═══════════════════════════════════════════════════════════
// LES CINQ ATELIERS
//
// ── Ne pas « corriger » ces identifiants ──
// L'id de la table `ateliers` ne suit pas l'ordre d'affichage :
// l'Atelier 3 (poudrage) porte l'id 4, et MOBILIX 1 (bois) porte
// l'id 3. C'est historique et volontaire — réattribuer l'id 3
// réécrirait tout l'historique MOBILIX.
//
// Ces cinq lignes sont la copie de `FICHES` dans
// src/lib/portail-atelier.ts. Si l'un des deux fichiers bouge,
// l'autre doit bouger — le contrôle croisé en bas de script le
// vérifie contre la table `ateliers` de la base.
// ═══════════════════════════════════════════════════════════
const ATELIERS = [
  { id: 1, slug: "a1", code: "A1", usine: "ADMEDCO", nom: "Tôle & Gros œuvre" },
  { id: 2, slug: "a2", code: "A2", usine: "ADMEDCO", nom: "Bureau" },
  { id: 4, slug: "a3", code: "A3", usine: "ADMEDCO", nom: "Poudrage & Emballage" },
  { id: 3, slug: "m1", code: "M1", usine: "MOBILIX", nom: "Découpe bois" },
  { id: 5, slug: "m2", code: "M2", usine: "MOBILIX", nom: "Tapissage" },
];

// ── L'alphabet des mots de passe ──
// Sans I, O, 0 ni 1 : sur une tablette d'atelier, ces caractères se
// confondent, et une faute de frappe passe pour un compte en panne.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const tirer = (n) =>
  Array.from({ length: n }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");

// ═══════════════════════════════════════════════════════════
// LES ARGUMENTS
// ═══════════════════════════════════════════════════════════
const args = process.argv.slice(2);
const reinitialiser = args.includes("--reinitialiser");
const argDomaine = args.find((a) => a.startsWith("--domaine="));
const domaine = (argDomaine ? argDomaine.slice("--domaine=".length) : "admedco.ma").trim();

// `a1=MonMotDePasse` — pour imposer un mot de passe plutôt qu'en tirer un.
const imposes = new Map();
for (const a of args) {
  const m = /^([a-z]\d)=(.+)$/.exec(a);
  if (m) imposes.set(m[1], m[2]);
}

// ═══════════════════════════════════════════════════════════
// LA CONFIGURATION — .env.local
// ═══════════════════════════════════════════════════════════
function chargerEnv() {
  const chemin = resolve(process.cwd(), ".env.local");
  if (!existsSync(chemin)) return;
  for (const ligne of readFileSync(chemin, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(ligne);
    if (!m) continue;
    const [, cle, brut] = m;
    // Une variable déjà présente dans l'environnement gagne : sur le
    // serveur, `pm2` peut fournir les vraies valeurs.
    if (process.env[cle]) continue;
    process.env[cle] = brut.trim().replace(/^["']|["']$/g, "");
  }
}
chargerEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !cle) {
  console.error(
    "\n  ✗ NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant.\n" +
      "    Renseignez-les dans .env.local (voir .env.example), puis relancez.\n"
  );
  process.exit(1);
}

const sb = createClient(url, cle, { auth: { persistSession: false, autoRefreshToken: false } });

// ═══════════════════════════════════════════════════════════
// LE TRAVAIL
// ═══════════════════════════════════════════════════════════
const emailDe = (a) => `${a.slug}@${domaine}`;

async function main() {
  console.log("\n  Comptes d'atelier — " + new URL(url).host);

  // ── Garde-fou : la base et ce script disent-ils la même chose ? ──
  // Si `ateliers` a bougé, on crée des profils qui pointent vers le
  // mauvais poste — et un ouvrier qui déclare au poste du voisin.
  const { data: table, error: eTable } = await sb
    .from("ateliers")
    .select("id, code, nom, usine")
    .order("id");

  if (eTable) {
    console.error(`\n  ✗ Lecture de la table « ateliers » impossible : ${eTable.message}\n`);
    process.exit(1);
  }

  for (const a of ATELIERS) {
    const trouve = (table ?? []).find((t) => t.id === a.id);
    if (!trouve) {
      console.error(`\n  ✗ Aucun atelier d'id ${a.id} en base (attendu : ${a.usine} ${a.code}).\n`);
      process.exit(1);
    }
    if (trouve.usine && trouve.usine !== a.usine) {
      console.error(
        `\n  ✗ L'atelier ${a.id} est « ${trouve.usine} » en base,` +
          ` mais « ${a.usine} » dans ce script. Les deux tables ont divergé.\n`
      );
      process.exit(1);
    }
  }

  // ── Les comptes déjà là ──
  const existants = new Map();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.error(`\n  ✗ Liste des comptes impossible : ${error.message}\n`);
      process.exit(1);
    }
    for (const u of data.users) if (u.email) existants.set(u.email.toLowerCase(), u.id);
    if (data.users.length < 200) break;
  }

  const lignes = [];

  for (const a of ATELIERS) {
    const email = emailDe(a);
    const nomComplet = `Équipe ${a.code} — ${a.nom}`;
    const connu = existants.get(email.toLowerCase());

    // Le mot de passe n'est tiré QUE s'il faut le poser : soit le
    // compte est neuf, soit on a demandé une réinitialisation.
    const aPoser = !connu || reinitialiser;
    const motDePasse = aPoser
      ? imposes.get(a.slug) ?? `Admco${a.code}-${tirer(5)}`
      : null;

    let userId = connu;

    if (!connu) {
      const { data, error } = await sb.auth.admin.createUser({
        email,
        password: motDePasse,
        email_confirm: true, // pas de courriel de confirmation : le compte est prêt
        user_metadata: { full_name: nomComplet, role: "WORKER" },
      });
      if (error) {
        console.error(`\n  ✗ Création de ${email} : ${error.message}\n`);
        process.exit(1);
      }
      userId = data.user?.id;
      if (!userId) {
        console.error(`\n  ✗ ${email} : aucun identifiant retourné par Supabase.\n`);
        process.exit(1);
      }
      console.log(`  + créé    ${email}`);
    } else if (reinitialiser) {
      const { error } = await sb.auth.admin.updateUserById(connu, {
        password: motDePasse,
        user_metadata: { full_name: nomComplet, role: "WORKER" },
      });
      if (error) {
        console.error(`\n  ✗ Mot de passe de ${email} : ${error.message}\n`);
        process.exit(1);
      }
      console.log(`  ↻ repris  ${email}`);
    } else {
      console.log(`  = présent ${email}  (mot de passe inchangé)`);
    }

    // ── Le profil ──
    // Le rattachement à l'atelier est ce qui décide OÙ l'ouvrier
    // atterrit : sans `atelier_id`, le portail le renvoie au hall au
    // lieu de sa file. C'est la colonne qui compte ici.
    const { error: eProfil } = await sb
      .from("profiles")
      .upsert(
        { id: userId, role: "WORKER", full_name: nomComplet, atelier_id: a.id },
        { onConflict: "id" }
      );

    if (eProfil) {
      console.error(`\n  ✗ Profil de ${email} : ${eProfil.message}\n`);
      process.exit(1);
    }

    lignes.push({ ...a, email, motDePasse });
  }

  // ══ La feuille de remise ══
  const base = (process.env.PORTAL_BASE_URL ?? "https://erp.admedco.com").replace(/\/+$/, "");

  const visibles = lignes.filter((l) => l.motDePasse);
  if (visibles.length) {
    const entete = ["Usine", "Atelier", "Adresse de connexion", "Identifiant", "Mot de passe"];
    const corps = visibles.map((l) => [
      l.usine,
      `${l.code} — ${l.nom}`,
      `${base}/portail/${l.usine.toLowerCase()}/${l.slug}`,
      l.email,
      l.motDePasse,
    ]);

    const largeurs = entete.map((_, i) => Math.max(...corps.map((r) => r[i].length), entete[i].length));
    const ligne = (r) => "  " + r.map((c, i) => c.padEnd(largeurs[i])).join("  │  ");

    console.log("\n  ── À transmettre ──\n");
    console.log(ligne(entete));
    console.log("  " + largeurs.map((w) => "─".repeat(w)).join("──┼──"));
    for (const r of corps) console.log(ligne(r));
    console.log("");

    const chemin = resolve(process.cwd(), "comptes-ateliers.csv");
    writeFileSync(
      chemin,
      ["Usine,Atelier,Adresse,Identifiant,Mot de passe"]
        .concat(
          visibles.map((l) =>
            [l.usine, `${l.code} — ${l.nom}`, `${base}/portail/${l.usine.toLowerCase()}/${l.slug}`, l.email, l.motDePasse]
              .map((c) => `"${String(c).replace(/"/g, '""')}"`)
              .join(",")
          )
        )
        .join("\n") + "\n",
      "utf8"
    );
    console.log(`  Feuille écrite : ${chemin}`);
    console.log("  ⚠  Ce fichier contient des mots de passe : ne le commitez pas.\n");
  } else {
    console.log("\n  Les cinq comptes existaient déjà. Pour réémettre les mots de passe :");
    console.log("    node scripts/creer-comptes-ateliers.mjs --reinitialiser\n");
  }
}

main().catch((e) => {
  console.error(`\n  ✗ ${e?.message ?? e}\n`);
  process.exit(1);
});
