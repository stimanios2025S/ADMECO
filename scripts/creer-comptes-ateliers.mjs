// ═══════════════════════════════════════════════════════════
// PRÉPARER LES CINQ PORTAILS D'ATELIER — hors application
//
// Usage (à la racine du projet, .env.local renseigné) :
//   node scripts/creer-comptes-ateliers.mjs
//
// ── À quoi ça sert, maintenant ──
//
// Les portails d'atelier n'ont plus ni identifiant ni mot de passe :
// on clique, ça ouvre (voir src/lib/ouvrir-atelier.ts). Le compte de
// chaque atelier est donc créé automatiquement au premier clic — ce
// script n'est PAS nécessaire au fonctionnement.
//
// Il sert à une chose : VÉRIFIER AVANT LA DÉMONSTRATION. Il crée les
// cinq comptes d'équipe, les rattache à leur atelier, et affiche une
// ligne par portail. Si une ligne est rouge, le portail ne s'ouvrira
// pas — autant le savoir maintenant, pas devant le patron.
//
// ── Aucun mot de passe n'est affiché ──
// Les comptes d'atelier reçoivent un mot de passe tiré au hasard, que
// le serveur remplace par le sien au premier clic. Il n'est pour
// personne : ni pour vous, ni pour l'ouvrier, ni pour le patron.
//
// ── Ce script ne détruit rien ──
// Un compte déjà présent n'est pas modifié (le mot de passe surtout) :
// le serveur le reprendra de toute façon à la première ouverture.
// ═══════════════════════════════════════════════════════════

import { existsSync, readFileSync } from "node:fs";
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
// Ces lignes recopient `FICHES` (src/lib/portail-atelier.ts), et le
// contrôle croisé plus bas les compare à la table `ateliers` : si les
// deux ont divergé, le script s'arrête au lieu de créer des profils
// qui pointent vers le mauvais poste.
// ═══════════════════════════════════════════════════════════
const ATELIERS = [
  { id: 1, slug: "a1", code: "A1", usine: "ADMEDCO", nom: "Tôle & Gros œuvre" },
  { id: 2, slug: "a2", code: "A2", usine: "ADMEDCO", nom: "Bureau" },
  { id: 4, slug: "a3", code: "A3", usine: "ADMEDCO", nom: "Poudrage & Emballage" },
  { id: 3, slug: "m1", code: "M1", usine: "MOBILIX", nom: "Découpe bois" },
  { id: 5, slug: "m2", code: "M2", usine: "MOBILIX", nom: "Tapissage" },
];

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
    // serveur, pm2 peut fournir les vraies valeurs.
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
const base = (process.env.PORTAL_BASE_URL ?? "https://erp.admedco.com").replace(/\/+$/, "");

// ── Le mot de passe jetable ──
// Jamais affiché, jamais transmis : le serveur pose le sien au premier
// clic. Sans I, O, 0 ni 1 — sur une tablette ces caractères se
// confondent, et une faute de frappe passerait pour une panne.
const tirerMotDePasse = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const t = Array.from({ length: 24 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `Jetable-${t}`;
};

async function main() {
  console.log(`\n  Portails d'atelier — ${new URL(url).host}\n`);

  // ── Garde-fou : la base et ce script disent-ils la même chose ? ──
  const { data: table, error: eTable } = await sb.from("ateliers").select("id, usine").order("id");

  if (eTable) {
    console.error(`  ✗ Lecture de la table « ateliers » impossible : ${eTable.message}\n`);
    process.exit(1);
  }

  for (const a of ATELIERS) {
    const trouve = (table ?? []).find((t) => t.id === a.id);
    if (!trouve) {
      console.error(`  ✗ Aucun atelier d'id ${a.id} en base (attendu : ${a.usine} ${a.code}).\n`);
      process.exit(1);
    }
    if (trouve.usine && trouve.usine !== a.usine) {
      console.error(
        `  ✗ L'atelier ${a.id} est « ${trouve.usine} » en base, mais « ${a.usine} » ici.` +
          ` Les deux tables ont divergé.\n`
      );
      process.exit(1);
    }
  }

  // ── Les comptes déjà là ──
  const existants = new Map();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.error(`  ✗ Liste des comptes impossible : ${error.message}\n`);
      process.exit(1);
    }
    for (const u of data.users) if (u.email) existants.set(u.email.toLowerCase(), u.id);
    if (data.users.length < 200) break;
  }

  const resultats = [];

  for (const a of ATELIERS) {
    const email = `${a.slug}@admedco.ma`;
    const nom = `Équipe ${a.code} — ${a.nom}`;
    const connu = existants.get(email.toLowerCase());
    let userId = connu;
    let action = "déjà prêt";

    if (!connu) {
      const { data, error } = await sb.auth.admin.createUser({
        email,
        password: tirerMotDePasse(),
        email_confirm: true, // aucun courriel : le portail ouvre tout de suite
        user_metadata: { full_name: nom, role: "WORKER" },
      });
      if (error) {
        resultats.push({ ...a, ok: false, detail: error.message });
        continue;
      }
      userId = data.user?.id ?? null;
      if (!userId) {
        resultats.push({ ...a, ok: false, detail: "identifiant non retourné" });
        continue;
      }
      action = "créé";
    }

    // ── Le rattachement ──
    // `atelier_id` décide OÙ l'ouvrier atterrit et CE QU'il voit :
    // sans elle, la porte s'ouvrirait sur un hall vide.
    const { error: eProfil } = await sb
      .from("profiles")
      .upsert({ id: userId, role: "WORKER", full_name: nom, atelier_id: a.id }, { onConflict: "id" });

    if (eProfil) {
      resultats.push({ ...a, ok: false, detail: eProfil.message });
      continue;
    }

    resultats.push({ ...a, ok: true, detail: action });
  }

  // ══ Le tableau ══
  const echecs = resultats.filter((r) => !r.ok);

  for (const r of resultats) {
    const marque = r.ok ? "✓" : "✗";
    const lien = `${base}/portail/${r.usine.toLowerCase()}/${r.slug}`;
    console.log(`  ${marque} ${r.usine.padEnd(8)} ${r.code}  ${r.nom.padEnd(24)} ${r.ok ? r.detail : r.detail}`);
    if (r.ok) console.log(`      ${lien}`);
  }

  if (echecs.length) {
    console.error(`\n  ${echecs.length} portail(s) en échec — à corriger avant la remise.\n`);
    process.exit(1);
  }

  console.log(`\n  Les cinq portails sont prêts. Aucun mot de passe n'est requis :`);
  console.log(`  chaque porte s'ouvre au clic.\n`);
}

main().catch((e) => {
  console.error(`\n  ✗ ${e?.message ?? e}\n`);
  process.exit(1);
});
