// ═══════════════════════════════════════════════════════════
// FICHE PRODUIT SILWANE — lecture seule des exports CSV
//
// Usage :
//   node scripts/fiche-produit.mjs CHG020 "CHG 021" SCLG021
//   node scripts/fiche-produit.mjs --dir E:/Massiexporte CHG020
//
// Pour chaque code article, affiche :
//   · la fiche article (COM_Item)
//   · la formule rattachée (COM_Formula)
//   · la nomenclature complète (COM_BOM) : code, désignation, quantité
//   · les totaux reconstitués, à comparer avec l'écran Silwane
//     (Nombre composants / Total PMP / Quantité)
//
// Aucune écriture, aucune connexion. Sert à CONTRÔLER une
// nomenclature avant de la faire entrer dans le MES.
// ═══════════════════════════════════════════════════════════
import { resolve } from "node:path";
import { chargerSilwane, trouverParCode, nomenclatureDe, num, DIR_DEFAUT } from "./silwane-csv.mjs";

const ARGS = process.argv.slice(2);
const iDir = ARGS.indexOf("--dir");
const DIR = resolve(iDir >= 0 ? ARGS[iDir + 1] : DIR_DEFAUT);
// `--dir` consomme l'argument suivant : on l'écarte. Sans `--dir`,
// aucun index n'est réservé — sinon le PREMIER code serait avalé.
const jValue = iDir >= 0 ? iDir + 1 : -1;
const CODES = ARGS.filter((a, i) => !a.startsWith("--") && i !== jValue).map((c) => c.toUpperCase());

if (CODES.length === 0) {
  console.error("Usage : node scripts/fiche-produit.mjs <CODE> [CODE…] [--dir chemin]");
  process.exit(1);
}

const d3 = (n) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(n);
const d2 = (n) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const ref = chargerSilwane(DIR);
console.log(`\n📁 ${DIR}`);
console.log(`   ${ref.items.length} articles · ${ref.formulas.length} formules · ${ref.bom.length} lignes de nomenclature`);

let incompletes = 0;

for (const code of CODES) {
  const art = trouverParCode(ref, code);
  if (!art) {
    console.log(`\n❌ ${code} : absent de COM_Item.csv`);
    incompletes++;
    continue;
  }

  const type = art.IsRawMaterial === "t" ? "Matière première"
    : art.IsSemiFinished === "t" ? "Semi-fini"
    : art.IsBOM === "t" ? "Produit fabriqué"
    : "Acheté / consommable";

  console.log(`\n${"═".repeat(72)}`);
  console.log(`  ${art.Code} — ${art.Label1 || art.Label2}`);
  console.log(`${"═".repeat(72)}`);
  console.log(`  Oid ${art.Oid} · ${type} · unité ${art.UnitOfMeasure || "—"} · famille ${ref.familleParOid.get(String(art.Family)) || "—"}`);
  console.log(`  Stock logique ${d3(num(art.LogicalQuantity))} · min ${d3(num(art.QuantityMin))} · PMP ${d2(num(art.VWAP))} DA`);
  if (art.Barcode) console.log(`  Code-barres ${art.Barcode}`);

  const { formule, lignes } = nomenclatureDe(ref, String(art.Oid));
  if (!formule) {
    console.log(`\n  ⚠️  AUCUNE formule rattachée à cet article.`);
    incompletes++;
    continue;
  }

  console.log(`\n  Formule ${formule.Code} (Oid ${formule.Oid}) · type « ${formule.Type ?? "—"} » · ${lignes.length} composant(s)`);
  if (lignes.length === 0) {
    console.log(`  ⚠️  Formule vide : aucune ligne dans COM_BOM.`);
    incompletes++;
    continue;
  }

  console.log("");
  console.log(`  ${"#".padStart(3)}  ${"Code".padEnd(13)} ${"Désignation".padEnd(38)} ${"Qté".padStart(10)} ${"PMP".padStart(11)} ${"Total".padStart(12)}  Unité`);
  console.log(`  ${"-".repeat(96)}`);

  let totalQte = 0;
  let totalPmp = 0;
  let inconnus = 0;
  lignes.forEach((b, i) => {
    const comp = ref.itemByOid.get(String(b.Item));
    const qte = num(b.Quantity);
    const pmp = comp ? num(comp.VWAP) : 0;
    totalQte += qte;
    totalPmp += qte * pmp;
    if (!comp) inconnus++;
    console.log(
      `  ${String(i + 1).padStart(3)}  ${(comp?.Code ?? `OID:${b.Item}`).padEnd(13)} ` +
        `${(comp?.Label1 ?? "⚠️ INTROUVABLE").slice(0, 37).padEnd(38)} ` +
        `${d3(qte).padStart(10)} ${d2(pmp).padStart(11)} ${d2(qte * pmp).padStart(12)}  ${comp?.UnitOfMeasure ?? "—"}`
    );
  });

  console.log(`  ${"-".repeat(96)}`);
  console.log(`  ${String(lignes.length).padStart(3)}  ${"TOTAUX".padEnd(53)} ${d3(totalQte).padStart(10)} ${"".padStart(11)} ${d2(totalPmp).padStart(12)}`);
  if (inconnus) console.log(`  ⚠️  ${inconnus} composant(s) absent(s) de COM_Item.csv — ils ne pourront pas être importés.`);
  console.log(`\n  ► À comparer avec l'écran Silwane : Nombre composants ${lignes.length} · Total PMP ${d2(totalPmp)} · Quantité ${d3(totalQte)}`);
}

console.log(`\n${"═".repeat(72)}`);
console.log(incompletes === 0 ? "✅ Toutes les fiches lues sont complètes." : `⚠️  ${incompletes} fiche(s) incomplète(s) — voir ci-dessus.`);
console.log("");
