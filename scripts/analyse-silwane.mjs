// ═══════════════════════════════════════════════════════════
// ANALYSE DES EXPORTS SILWANE (lecture seule — n'écrit rien)
// Usage : node scripts/analyse-silwane.mjs [chemin-exports]
// Défaut : E:/Massiexporte
// But : compter les articles réels, la matière première, le stock
//       physique, les produits fabriqués et la valeur du stock.
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

const num = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const bool = (v) => String(v ?? "").toLowerCase() === "t";
const fmt = (n) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n);

const items = parseCsv("COM_Item.csv");
const families = parseCsv("COM_ItemFamily.csv");
const third = parseCsv("COM_ThirdParty.csv");
const batches = parseCsv("COM_Batch.csv");
const formulas = parseCsv("COM_Formula.csv");
const bom = parseCsv("COM_BOM.csv");

console.log(`\n📁 Source : ${DIR}\n`);
console.log("── VOLUMES ──");
console.log(`  Articles (COM_Item)      : ${items.length}`);
console.log(`  Familles (ItemFamily)    : ${families.length}`);
console.log(`  Tiers (ThirdParty)       : ${third.length}`);
console.log(`  Lots (Batch)             : ${batches.length}`);
console.log(`  Formules (Formula)       : ${formulas.length}`);
console.log(`  Lignes BOM               : ${bom.length}`);

// ── Classement des articles ──
const raw = items.filter((i) => bool(i.IsRawMaterial));
const semi = items.filter((i) => bool(i.IsSemiFinished));
const fab = items.filter((i) => bool(i.IsBOM));
const vendables = items.filter((i) => !bool(i.IsRawMaterial) && !bool(i.IsSemiFinished) && !bool(i.IsBOM));

console.log("\n── TYPOLOGIE (colonnes IsRawMaterial / IsSemiFinished / IsBOM) ──");
console.log(`  Matière première (IsRawMaterial)  : ${raw.length}`);
console.log(`  Semi-fini (IsSemiFinished)        : ${semi.length}`);
console.log(`  Produit fabriqué (IsBOM)          : ${fab.length}`);
console.log(`  Ni l'un ni l'autre (acheté/revendu): ${vendables.length}`);

// ── Stock réel ──
const avecPhysique = items.filter((i) => num(i.PhysicalQuantity) !== 0);
const valeurStock = items.reduce((s, i) => s + num(i.PhysicalQuantity) * num(i.VWAP), 0);
const valeurLogique = items.reduce((s, i) => s + num(i.LogicalQuantity) * num(i.VWAP), 0);
console.log("\n── STOCK ──");
console.log(`  Articles avec PhysicalQuantity ≠ 0 : ${avecPhysique.length}`);
console.log(`  Somme PhysicalQuantity             : ${fmt(items.reduce((s, i) => s + num(i.PhysicalQuantity), 0))}`);
console.log(`  Somme LogicalQuantity              : ${fmt(items.reduce((s, i) => s + num(i.LogicalQuantity), 0))}`);
console.log(`  Stock négatif (PhysicalQuantity<0) : ${items.filter((i) => num(i.PhysicalQuantity) < 0).length}`);
console.log(`  Valeur stock (Physical × VWAP)     : ${fmt(valeurStock)} DA`);
console.log(`  Valeur stock (Logical  × VWAP)     : ${fmt(valeurLogique)} DA`);
console.log(`  Articles réservés (ReservedQuantity≠0) : ${items.filter((i) => num(i.ReservedQuantity) !== 0).length}`);

const avecLogique = items.filter((i) => num(i.LogicalQuantity) !== 0);
console.log(`  Articles avec LogicalQuantity ≠ 0  : ${avecLogique.length}`);
const parFamille = new Map();
for (const i of avecLogique) parFamille.set(i.Family, (parFamille.get(i.Family) ?? 0) + 1);
console.log("  Répartition des articles en stock par famille :");
for (const [f, n] of [...parFamille].sort((a, b) => b[1] - a[1])) {
  const fam = families.find((x) => String(x.Oid) === String(f));
  console.log(`     ${String(fam?.Label1 ?? `Oid ${f}`).padEnd(26)} ${n}`);
}

// ── Familles réelles ──
console.log("\n── FAMILLES RÉELLES (COM_ItemFamily) ──");
for (const f of families) {
  const n = items.filter((i) => String(i.Family) === String(f.Oid)).length;
  console.log(`  [${f.Oid}] ${(f.Label1 || "").padEnd(28)} code=${(f.Label2 || "-").padEnd(10)} articles=${n}`);
}

// ── Unités ──
const unites = new Map();
for (const i of items) unites.set(i.UnitOfMeasure || "(vide)", (unites.get(i.UnitOfMeasure || "(vide)") ?? 0) + 1);
console.log("\n── UNITÉS ──");
for (const [u, n] of [...unites].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`  ${String(u).padEnd(14)} ${n}`);

// ── Produits fabriqués avec nomenclature ──
const formulaByOid = new Map();
for (const f of formulas) formulaByOid.set(String(f.Oid), f);
const bomByFormula = new Map();
for (const b of bom) {
  const k = String(b.Formula);
  bomByFormula.set(k, (bomByFormula.get(k) ?? 0) + 1);
}
const withBom = formulas.filter((f) => bomByFormula.has(String(f.Oid))).length;
console.log("\n── NOMENCLATURES ──");
console.log(`  Formules avec lignes BOM : ${withBom} / ${formulas.length}`);
console.log(`  Formules sans BOM        : ${formulas.length - withBom}`);
const tailles = [...bomByFormula.values()].sort((a, b) => b - a);
console.log(`  Composants/formule : max ${tailles[0] ?? 0}, médiane ${tailles[Math.floor(tailles.length / 2)] ?? 0}`);

// ── Top 10 produits finis par nb de composants ──
const itemByOid = new Map(items.map((i) => [String(i.Oid), i]));
const top = [...bomByFormula.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
console.log("\n── TOP 10 NOMENCLATURES (produit fini) ──");
for (const [fOid, n] of top) {
  const f = formulaByOid.get(fOid);
  const art = f ? itemByOid.get(String(f.Item)) : null;
  console.log(`  ${String(art?.Code ?? "?").padEnd(16)} ${String(art?.Label1 ?? f?.Label1 ?? "?").slice(0, 40).padEnd(42)} ${n} composants`);
}

// ── Matières premières réelles (échantillon) ──
console.log("\n── MATIÈRES PREMIÈRES (10 premières) ──");
for (const i of raw.slice(0, 10)) {
  console.log(`  ${String(i.Code).padEnd(16)} ${String(i.Label1).slice(0, 40).padEnd(42)} stock=${fmt(num(i.PhysicalQuantity))} ${i.UnitOfMeasure ?? ""} VWAP=${fmt(num(i.VWAP))}`);
}

// ── Tiers ──
const parType = new Map();
for (const t of third) parType.set(t.Type || "(vide)", (parType.get(t.Type || "(vide)") ?? 0) + 1);
console.log("\n── TIERS par Type ──");
for (const [t, n] of parType) console.log(`  Type ${String(t).padEnd(8)} ${n}`);

// ── Lots ──
const lotsAvecQte = batches.filter((b) => num(b.PhysicalQuantity) !== 0);
console.log("\n── LOTS ──");
console.log(`  Lots avec PhysicalQuantity ≠ 0 : ${lotsAvecQte.length} / ${batches.length}`);
console.log(`  Somme quantités des lots       : ${fmt(batches.reduce((s, b) => s + num(b.PhysicalQuantity), 0))}`);

// ── Anomalies à corriger à l'import ──
console.log("\n── ANOMALIES DÉTECTÉES ──");
const sansCode = items.filter((i) => !i.Code?.trim()).length;
const sansLabel = items.filter((i) => !i.Label1?.trim()).length;
const codesDup = (() => {
  const m = new Map();
  for (const i of items) { const c = i.Code?.trim(); if (c) m.set(c, (m.get(c) ?? 0) + 1); }
  return [...m.entries()].filter(([, n]) => n > 1);
})();
console.log(`  Articles sans code      : ${sansCode}`);
console.log(`  Articles sans libellé   : ${sansLabel}`);
console.log(`  Codes dupliqués         : ${codesDup.length}${codesDup.length ? " → " + codesDup.slice(0, 8).map(([c, n]) => `${c}×${n}`).join(", ") : ""}`);
const famInconnues = new Set(items.map((i) => String(i.Family)).filter((f) => f && f !== "0" && !families.some((x) => String(x.Oid) === f)));
console.log(`  Familles non résolues   : ${famInconnues.size}${famInconnues.size ? " → " + [...famInconnues].slice(0, 10).join(", ") : ""}`);
console.log("");
