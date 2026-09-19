// ═══════════════════════════════════════════════════════════
// LES OPÉRATIONS CACHÉES DANS LA NOMENCLATURE — lecture seule
// Usage : node scripts/operations-silwane.mjs [chemin-exports]
//
// Silwane n'a jamais enregistré de gamme (COM_FormulaMachine /
// COM_FormulaCharge / COM_FormulaEmpoyees sont vides). MAIS la
// nomenclature contient des articles de MAIN D'ŒUVRE :
//     MD001 MAIN D'OEUVRE PREPARATION
//     MD002 MAIN D'OEUVRE SOUDAGE
//     MD003 MAIN D'OEUVRE POUDRAGE
//     MD004 MAIN D'OEUVRE EMBALLAGE ET MONTAGE
//     MD005 MAIN D'OEUVRE CACHE JUPE
//     ECO COP / ECO VIS / ECO ASS
// Ces lignes nomment l'opération. Si un produit les appelle dans sa
// nomenclature, sa gamme est ÉCRITE, pas devinée.
//
// Ce script mesure la couverture : combien de produits portent cette
// information, et combien ne l'ont pas.
// ═══════════════════════════════════════════════════════════
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const DIR = resolve(process.argv[2] ?? "E:/Massiexporte");

function parseCsv(file) {
  const path = join(DIR, file);
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
  const rows = [];
  let cur = [""], q = false;
  const push = () => { rows.push(cur); cur = [""]; };
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (q) {
      if (c === '"') { q = raw[i + 1] === '"' ? (cur[cur.length - 1] += '"', i++, true) : false; }
      else cur[cur.length - 1] += c;
    } else if (c === '"') q = true;
    else if (c === ";") cur.push("");
    else if (c === "\n") push();
    else if (c !== "\r") cur[cur.length - 1] += c;
  }
  if (cur.length > 1 || cur[0] !== "") push();
  const [head, ...data] = rows.filter((r) => r.length > 1 || r[0].trim() !== "");
  return data.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

const items = parseCsv("COM_Item.csv");
const bom = parseCsv("COM_BOM.csv");
const formulas = parseCsv("COM_Formula.csv");

const art = new Map(items.filter((a) => a.Oid).map((a) => [String(a.Oid), a]));
const designation = (oid) => (art.get(String(oid))?.Label1 || "").trim();
const code = (oid) => (art.get(String(oid))?.Code || "").trim();

// Un article porte-t-il une opération dans son libellé ?
const OPERATIONNELLE = /^(MAIN D'?OEUVRE|MAIN D'OUVRE|ECO\s|SOUS\s?TRAITANCE)/i;
const estOperationnelle = (oid) => OPERATIONNELLE.test(designation(oid));

console.log(`\n📁 ${DIR}`);
console.log(`   ${items.length} articles · ${formulas.length} formules · ${bom.length} lignes de nomenclature\n` + "═".repeat(78));

// ── 1. Les articles-opérations et leur usage ──
const usuParArticle = new Map();
for (const b of bom) {
  if (!b.Item || !estOperationnelle(b.Item)) continue;
  const k = String(b.Item);
  if (!usuParArticle.has(k)) usuParArticle.set(k, new Set());
  usuParArticle.get(k).add(String(b.Formula));
}
// Les articles-opérations jamais appelés restent visibles (usage 0)
for (const a of items) if (a.Oid && estOperationnelle(a.Oid)) {
  if (!usuParArticle.has(String(a.Oid))) usuParArticle.set(String(a.Oid), new Set());
}

console.log(`\n① ARTICLES-OPÉRATIONS (main d'œuvre / sous-traitance)\n`);
console.log(`   ${"CODE".padEnd(14)} ${"UTILISÉ PAR".padStart(10)}  DÉSIGNATION`);
console.log("   " + "─".repeat(74));
let totalOpArticles = 0;
for (const [oid, formules] of [...usuParArticle].sort((a, b) => b[1].size - a[1].size)) {
  totalOpArticles++;
  const flag = formules.size === 0 ? "⚠️ " : "   ";
  console.log(`   ${flag}${code(oid).padEnd(11)} ${String(formules.size).padStart(10)}  ${designation(oid)}`);
}
console.log(`\n   ${totalOpArticles} articles-opérations · ${[...usuParArticle.values()].filter((s) => s.size > 0).length} réellement appelés`);

// ── 2. Couverture : combien de produits portent une gamme écrite ? ──
const produitsAvec = new Set();
const parProduit = new Map();
for (const [oid, formules] of usuParArticle) {
  for (const f of formules) {
    produitsAvec.add(f);
    if (!parProduit.has(f)) parProduit.set(f, []);
    parProduit.get(f).push(designation(oid));
  }
}
const produitDeFormule = new Map(formulas.filter((f) => f.Oid && f.Item).map((f) => [String(f.Oid), String(f.Item)]));
const totalProduits = new Set([...produitDeFormule.keys()]).size;

console.log(`\n② COUVERTURE\n` + "   " + "─".repeat(74));
console.log(`   Produits (formules)                        : ${totalProduits}`);
console.log(`   Produits avec opération NOMMÉE dans le BOM : ${produitsAvec.size}  (${Math.round((produitsAvec.size / totalProduits) * 100)} %)`);
console.log(`   Produits SANS opération nommée             : ${totalProduits - produitsAvec.size}  → gamme à déduire des matières`);

// ── 3. Ce que chaque opération nommée désigne, à plat ──
const libelles = new Map();
for (const [oid] of usuParArticle) {
  if (usuParArticle.get(oid).size === 0) continue;
  const lib = designation(oid);
  // Normaliser : « MAIN D'OEUVRE SOUDAGE » et « ECO VISSAGE » → « SOUDAGE » / « VISSAGE »
  const mot = lib.replace(/^(MAIN D'?[OE]{2}UVRE|MAIN D'OUVRE|ECO)\s*/i, "").trim().toUpperCase();
  libelles.set(mot, (libelles.get(mot) ?? 0) + usuParArticle.get(oid).size);
}
console.log(`\n③ OPÉRATIONS RÉELLEMENT NOMMÉES\n` + "   " + "─".repeat(74));
for (const [mot, n] of [...libelles].sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(4)} produits  →  ${mot}`);

// ── 4. Échantillon : gamme écrite de 6 produits ──
console.log(`\n④ ÉCHANTILLON — gammes ÉCRITES dans la nomenclature\n` + "   " + "─".repeat(74));
for (const f of [...produitsAvec].slice(0, 6)) {
  const oidProduit = produitDeFormule.get(f);
  console.log(`\n   ${code(oidProduit)} — ${designation(oidProduit).slice(0, 50)}`);
  for (const lib of parProduit.get(f) ?? []) console.log(`      • ${lib}`);
}
console.log("");
