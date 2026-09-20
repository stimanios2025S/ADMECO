// ═══════════════════════════════════════════════════════════
// LES PRODUITS PHARES — ONT-ILS BIEN LEUR NOMENCLATURE ?
//
// Usage :
//   node scripts/diagnostic-produits.mjs
//   node scripts/diagnostic-produits.mjs "CHG020" "CHG 021" "SCLG021"
//   node scripts/diagnostic-produits.mjs --dir E:/Massiexporte
//
// ── Pourquoi ce script existe ──
// L'import annonce « 2139 lignes de nomenclature ». Ce total ne dit
// pas si les articles QUI COMPTENT ont leur formule. Un article peut
// très bien n'avoir aucune nomenclature — un article acheté, par
// exemple — et c'est normal ; ce qui ne le serait pas, c'est qu'une
// chaise fabriquée arrive en production sans matière à sortir.
//
// ── Le piège qu'il a levé ──
// Les codes Silwane ne sont pas propres : le même produit s'écrit
// `CHG020` (sans espace) et `CHG 021` (avec). Une recherche sur
// « CHG021 » ne trouve donc RIEN, ce qui se lit « le produit n'a pas
// été importé » alors qu'il est bien là. Ce script affiche le code
// ENTRE CROCHETS pour que l'espace se voie.
//
// Lecture seule : aucun accès base, aucune écriture.
// ═══════════════════════════════════════════════════════════
import { resolve } from "node:path";
import { parseCsv, DIR_DEFAUT } from "./silwane-csv.mjs";

const ARGS = process.argv.slice(2);
const iDir = ARGS.indexOf("--dir");
const DIR = resolve(iDir >= 0 ? ARGS[iDir + 1] : DIR_DEFAUT);
const CODES = ARGS.filter((a, i) => !a.startsWith("--") && i !== iDir + 1);
const CIBLES = CODES.length ? CODES : ["CHG020", "CHG 021", "SCLG021"];

const items = parseCsv(DIR, "COM_Item.csv");
const formulas = parseCsv(DIR, "COM_Formula.csv");
const bom = parseCsv(DIR, "COM_BOM.csv");
const familles = parseCsv(DIR, "COM_ItemFamily.csv");

// ── Le même chemin que l'import ──
const artParOid = new Map(items.filter((a) => a.Oid).map((a) => [String(a.Oid), a]));
const famParOid = new Map(familles.filter((f) => f.Oid).map((f) => [String(f.Oid), f]));

// Une ligne de COM_BOM est du REMPLISSAGE si SyncId est vide ET que
// tous ses champs le sont aussi, hormis Oid et Offset. 2742 sur 5057.
const estRemplissage = (r) => {
  if (String(r.SyncId ?? "").trim() !== "") return false;
  return Object.entries(r).every(
    ([k, v]) => k === "Oid" || k === "Offset" || String(v ?? "").trim() === "",
  );
};

// Formule → article produit fini, via la colonne `Item` (l'Oid article).
const formuleParOid = new Map();
for (const f of formulas) {
  if (f.Oid && f.Item && artParOid.has(String(f.Item))) formuleParOid.set(String(f.Oid), f);
}

// Lignes utiles, rattachées à leur formule.
const lignesParArticle = new Map();
let rattachees = 0;
for (const b of bom) {
  if (estRemplissage(b)) continue;
  const f = formuleParOid.get(String(b.Formula));
  if (!f) continue;
  rattachees++;
  const articleOid = String(f.Item);
  const liste = lignesParArticle.get(articleOid) ?? [];
  liste.push(b);
  lignesParArticle.set(articleOid, liste);
}

const num = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const code = (oid) => artParOid.get(String(oid))?.Code?.trim() || `ART-${oid}`;
const des = (oid) => artParOid.get(String(oid))?.Label1?.trim() || "—";
const unite = (oid) => artParOid.get(String(oid))?.UnitOfMeasure?.trim() || "";
const famille = (oid) => {
  const a = artParOid.get(String(oid));
  const f = a ? famParOid.get(String(a.Family)) : null;
  return f?.Label1?.trim() || "—";
};
const estMO = (oid) => /^MD\d+$/i.test(code(oid));

console.log(`\n📁 ${DIR}`);
console.log(`   articles COM_Item ................ ${items.length}`);
console.log(`   formules rattachées à un article . ${formuleParOid.size}`);
console.log(`   lignes de nomenclature utiles .... ${rattachees}`);
console.log(`   articles ayant une formule ....... ${lignesParArticle.size}`);
console.log(`   articles IsBOM = t ............... ${items.filter((a) => a.IsBOM === "t").length}`);

for (const cible of CIBLES) {
  const cherche = cible.replace(/\s+/g, "").toUpperCase();
  const a = items.find((x) => String(x.Code ?? "").replace(/\s+/g, "").toUpperCase() === cherche);

  console.log(`\n${"─".repeat(60)}`);
  if (!a) {
    console.log(`❌ « ${cible} » — INTROUVABLE dans COM_Item.csv.`);
    const proches = items
      .filter((x) => String(x.Code ?? "").replace(/\s+/g, "").toUpperCase().startsWith(cherche.slice(0, 4)))
      .slice(0, 8);
    if (proches.length)
      console.log(`   Codes voisins : ${proches.map((p) => `[${p.Code.trim()}]`).join(" · ")}`);
    continue;
  }

  const lignes = lignesParArticle.get(String(a.Oid)) ?? [];
  const formule = lignes[0] ? formuleParOid.get(String(lignes[0].Formula)) : null;

  console.log(`✅ code [${String(a.Code).trim()}]   ← les espaces comptent, cherchez « ${String(a.Code).replace(/\s+/g, "")} »`);
  console.log(`   désignation ...... ${des(a.Oid)}`);
  console.log(`   famille .......... ${famille(a.Oid)}`);
  console.log(`   IsBOM ............ ${a.IsBOM}      IsRawMaterial ... ${a.IsRawMaterial}`);
  console.log(`   unité ............ ${unite(a.Oid)}`);
  console.log(`   formule .......... ${formule ? `${formule.Code?.trim()} (Oid ${formule.Oid})` : "AUCUNE"}`);
  console.log(`   composants ....... ${lignes.length}`);

  if (lignes.length === 0) {
    console.log(`   ⚠️  Cet article n'a aucune nomenclature : la matière ne sera`);
    console.log(`       pas réservée automatiquement à la création de la commande.`);
    continue;
  }

  const tri = [...lignes].sort((x, y) => code(x.Item).localeCompare(code(y.Item)));
  for (const b of tri) {
    const marque = estMO(b.Item) ? "MO" : "MP";
    console.log(
      `     ${marque}  ${code(b.Item).padEnd(14)} ${String(num(b.Quantity)).padStart(12)} ${unite(b.Item).padEnd(4)} ${des(b.Item)}`,
    );
  }
  const mo = lignes.filter((b) => estMO(b.Item)).length;
  console.log(`   → ${lignes.length - mo} matière(s) à sortir du stock, ${mo} main(s) d'œuvre.`);
}

console.log("");
