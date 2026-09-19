// ═══════════════════════════════════════════════════════════
// VÉRIFIER LA CHAÎNE D'UN PRODUIT — hors application
//
// Usage :
//   node scripts/verifier-chaine.mjs CHG020 "CHG 021"
//   node scripts/verifier-chaine.mjs CHG020 --qte 50
//   node scripts/verifier-chaine.mjs CHG020 --dir E:/Massiexporte
//
// Ce script ne RÉIMPLÉMENTE rien : il compile les modules purs du
// MES (`triage.ts`, `route-production.ts`, `agent-matiere.ts`) et
// les exécute sur les exports Silwane. Ce qu'il affiche est donc
// exactement ce que l'application calculera — sans base de données
// et sans rien écrire.
//
// ── Ce qu'il faut savoir sur les entrées ──
//
//   · Les identifiants sont les `Oid` Silwane : les fonctions pures
//     ne s'attachent qu'à l'identité des clés.
//   · Les RENDEMENTS sont vides : le script montre donc un
//     éclatement 1 pour 1, ce que fait le MES tant que
//     `rendement_matiere` n'est pas renseigné (écran Rendements).
//   · Le STOCK est approché par `LogicalQuantity` de l'export —
//     c'est la quantité que l'import écrit dans `stock_items`. La
//     couverture matière est donc réaliste, pas exacte.
// ═══════════════════════════════════════════════════════════
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { chargerSilwane, trouverParCode, nomenclatureDe, num, DIR_DEFAUT } from "./silwane-csv.mjs";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, "..");
const SORTIE = resolve(RACINE, ".tmp-sim");

const ARGS = process.argv.slice(2);
const iDir = ARGS.indexOf("--dir");
const iQte = ARGS.indexOf("--qte");
const QTE = iQte >= 0 ? Number(ARGS[iQte + 1]) || 1 : 1;
const DIR = resolve(iDir >= 0 ? ARGS[iDir + 1] : DIR_DEFAUT);
const reserves = new Set([iDir >= 0 ? iDir + 1 : -1, iQte >= 0 ? iQte + 1 : -1, -1]);
const CODES = ARGS.filter((a, i) => !a.startsWith("--") && !reserves.has(i));

if (CODES.length === 0) {
  console.error('Usage : node scripts/verifier-chaine.mjs <CODE> [CODE…] [--qte N] [--dir chemin]');
  process.exit(1);
}

// ── 1. Compiler les modules purs du MES ──
// On compile plutôt que de recopier la logique : une divergence
// entre ce script et l'application serait un mensonge silencieux.
if (!existsSync(resolve(SORTIE, "triage.js"))) {
  console.log("⏳ Compilation des modules purs du MES…");
  execSync(
    "npx tsc src/lib/triage.ts src/lib/route-production.ts src/lib/agent-matiere.ts src/lib/etapes.ts " +
      "--outDir .tmp-sim --module commonjs --target ES2020 --skipLibCheck --declaration false",
    { cwd: RACINE, stdio: "inherit" }
  );
}

const require = createRequire(import.meta.url);
const { trierCommande, destinationPart } = require(resolve(SORTIE, "triage.js"));
const { routePour, chargeParAtelier } = require(resolve(SORTIE, "route-production.js"));
const { planifierMatiere } = require(resolve(SORTIE, "agent-matiere.js"));
const { ATELIERS } = require(resolve(SORTIE, "ateliers.js"));

// ⚠️ Ne JAMAIS afficher « A<id> ». L'Atelier 3 porte l'identifiant 4
//    (l'id 3 est MOBILIX) : écrire « A4 » ferait lire un quatrième
//    atelier qui n'existe pas. C'est le CODE qui s'affiche.
const codeAtelier = (id) => ATELIERS.find((a) => a.id === id)?.code ?? `#${id}`;

// ── 2. Construire le contexte à partir des exports ──
const ref = chargerSilwane(DIR);
console.log(`\n📁 ${DIR} — ${ref.items.length} articles · ${ref.bom.length} lignes de nomenclature`);

const articles = new Map();
for (const a of ref.items) {
  if (!a.Oid) continue;
  const oid = String(a.Oid);
  articles.set(oid, {
    id: oid,
    code: (a.Code || "").trim(),
    designation: (a.Label1 || a.Label2 || "").trim(),
    unite: (a.UnitOfMeasure || "pcs").trim(),
    estFabrique: ref.estFabrique(a),
  });
}

const nomenclature = [];
for (const b of ref.bom) {
  if (!b.Formula || !b.Item) continue;
  const f = ref.formuleParOid.get(String(b.Formula));
  if (!f?.Item) continue;
  nomenclature.push({
    articleId: String(f.Item),
    composantId: String(b.Item),
    quantite: num(b.Quantity) || 1,
  });
}

// Stock approché par le stock logique de l'export.
const stocks = [];
for (const a of ref.items) {
  if (!a.Oid) continue;
  const q = num(a.LogicalQuantity);
  if (!(q > 0)) continue;
  stocks.push({
    stockItemId: `S-${a.Oid}`,
    articleId: String(a.Oid),
    depotCode: ref.estFabrique(a) ? "DEP-PF" : "DEP-MP",
    quantite: q,
    reserve: 0,
    minQty: num(a.QuantityMin) || null,
    maxQty: num(a.QuantityMax) || null,
  });
}

const ctx = {
  usineCode: "ADMEDCO",
  articles,
  nomenclature,
  rendements: [],
  stocks,
};

const d3 = (n) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(n);
let anomalies = 0;

// ── 3. Rejouer la chaîne, produit par produit ──
for (const code of CODES) {
  const art = trouverParCode(ref, code);
  console.log(`\n${"═".repeat(78)}`);
  if (!art) {
    console.log(`  ❌ ${code} : introuvable`);
    anomalies++;
    continue;
  }
  console.log(`  ${art.Code} — ${art.Label1}`);
  console.log(`${"═".repeat(78)}`);

  const oid = String(art.Oid);
  const { formule, lignes } = nomenclatureDe(ref, oid);
  console.log(`  Formule ${formule?.Code ?? "—"} · ${lignes.length} composant(s) direct(s) · quantité simulée ${QTE}`);

  if (lignes.length === 0) {
    console.log(`  ⚠️  Aucune nomenclature : le triage ne peut rien répartir.`);
    anomalies++;
    continue;
  }

  // ── 3a. Le triage ──
  const triage = trierCommande(oid, QTE, ctx);
  console.log(`\n  ── TRIAGE : ${triage.repartitions.length} ordre(s) de fabrication ──`);
  for (const r of triage.repartitions) {
    const route = routePour(r.parcours);
    const charge = chargeParAtelier(r.parcours);
    const ateliers = Object.entries(charge)
      .map(([id, n]) => `${codeAtelier(Number(id))}:${n}`)
      .join("  ");
    console.log(`\n  ▸ ${r.usineCode} — parcours ${r.parcours}`);
    console.log(`    ${route.length} étapes · charge ${ateliers}`);
    console.log(`    destination : ${destinationPart(r.usineCode, triage)}`);
    console.log(`    composants rattachés (${r.composants.length}) :`);
    for (const c of r.composants) console.log(`       · ${c.code.padEnd(13)} ${c.designation}`);
    console.log(`    ordre global des étapes :`);
    for (const e of route) {
      console.log(`       ${String(e.sequence).padStart(3)}  ${codeAtelier(e.atelier).padEnd(3)} étape ${String(e.ordreAtelier).padStart(4)}  ${e.code.padEnd(14)} ${e.nom}`);
    }
  }
  if (triage.nonClassee.length) {
    console.log(`\n    ⚠️  ${triage.nonClassee.length} composant(s) non rattaché(s) :`);
    for (const c of triage.nonClassee) console.log(`       · ${c.code.padEnd(13)} ${c.designation}`);
  }

  // ── 3b. La matière ──
  const plan = planifierMatiere(oid, QTE, ctx);
  console.log(`\n  ── MATIÈRE : ${plan.besoins.length} matière(s) en feuille ──`);
  console.log(`    ${"Code".padEnd(13)} ${"Désignation".padEnd(36)} ${"Brut".padStart(11)} ${"Net".padStart(11)}  Rendement`);
  console.log(`    ${"-".repeat(84)}`);
  for (const b of plan.besoins) {
    console.log(
      `    ${b.code.padEnd(13)} ${b.designation.slice(0, 35).padEnd(36)} ` +
        `${d3(b.quantiteBrute).padStart(11)} ${d3(b.quantiteNette).padStart(11)}  ` +
        (b.rendementRenseigne ? `÷ ${d3(b.rendementApplique)}` : "1 pour 1 (non renseigné)")
    );
  }
  if (plan.manquants.length) {
    console.log(`\n    ⚠️  ${plan.manquants.length} matière(s) non couverte(s) par le stock :`);
    for (const m of plan.manquants) console.log(`       · ${m.code.padEnd(13)} manque ${d3(m.manque)} ${m.unite}`);
  } else {
    console.log(`\n    ✅ Toutes les matières sont couvertes par le stock déclaré.`);
  }

  // ── 3c. Contrôles de cohérence ──
  // Les séquences se vérifient PAR ORDRE : chaque ordre de
  // fabrication est une pièce distincte, et son parcours repart de
  // 10. Comparer les séquences de deux ordres entre elles ferait
  // apparaître des « doublons » qui sont en réalité normaux.
  console.log(`\n  ── CONTRÔLES ──`);
  let totalEtapes = 0;
  let incohérent = 0;
  for (const r of triage.repartitions) {
    const route = routePour(r.parcours);
    totalEtapes += route.length;
    const seqs = route.map((e) => e.sequence);
    const croissant = seqs.every((s, i) => i === 0 || s > seqs[i - 1]);
    const unique = new Set(seqs).size === seqs.length;
    const ok = route.length > 0 && croissant && unique;
    if (!ok) incohérent++;
    console.log(
      `    ${r.usineCode.padEnd(9)} ${String(route.length).padStart(3)} étapes · ` +
        `séquences ${ok ? "croissantes et uniques ✅" : "INCOHÉRENTES ❌"}`
    );
  }
  console.log(`    ordres de fabrication ............ ${triage.repartitions.length}`);
  console.log(`    étapes au total .................. ${totalEtapes}`);

  // Invariant : la somme des composants répartis + non classés doit
  // égaler les composants directs lus dans la nomenclature. Un écart
  // signalerait un composant perdu en route par le triage.
  const directs = ctx.nomenclature.filter((l) => l.articleId === oid).length;
  const repartis =
    triage.repartitions.reduce((n, r) => n + r.composants.length, 0) + triage.nonClassee.length;
  console.log(
    `    composants directs ............... ${directs}\n` +
      `    composants répartis + listés ..... ${repartis} ${repartis === directs ? "✅" : "❌ ÉCART"}`
  );

  if (incohérent || repartis !== directs || triage.repartitions.length === 0) anomalies++;
}

console.log(`\n${"═".repeat(78)}`);
console.log(
  anomalies === 0
    ? "✅ Chaîne vérifiée : triage, route et matière se déroulent sans anomalie."
    : `⚠️  ${anomalies} anomalie(s) — voir ci-dessus.`
);
console.log(`   Pour la même vérification sur la base réelle : /admin/simulateur\n`);
