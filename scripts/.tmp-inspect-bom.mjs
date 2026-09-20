// Où vit réellement l'information dans COM_BOM.csv ?
// Lecture seule, aucune base, aucune clé. À supprimer après usage.
import { parseCsv, DIR_DEFAUT } from "./silwane-csv.mjs";

const rows = parseCsv(DIR_DEFAUT, "COM_BOM.csv");
console.log(`lignes : ${rows.length}`);
console.log(`\n── COLONNES ──`);
console.log(Object.keys(rows[0]).join("  |  "));

const vides = rows.filter((b) => !String(b.Formula ?? "").trim());
console.log(`\n── LIGNES SANS Formula : ${vides.length} ──`);

// Quelles colonnes sont renseignées sur ces lignes ?
console.log("\n── TAUX DE REMPLISSAGE DES LIGNES SANS Formula ──");
for (const k of Object.keys(rows[0])) {
  const n = vides.filter((r) => String(r[k] ?? "").trim() !== "").length;
  console.log(`   ${String(n).padStart(6)} / ${vides.length}   ${k}`);
}

console.log("\n── 3 LIGNES SANS Formula, champ par champ ──");
for (const r of vides.slice(0, 3)) {
  console.log("   " + Object.entries(r)
    .filter(([, v]) => String(v ?? "").trim() !== "")
    .map(([k, v]) => `${k}=${v}`)
    .join("  "));
}

console.log("\n── 2 LIGNES AVEC Formula, pour comparer ──");
for (const r of rows.filter((b) => String(b.Formula ?? "").trim()).slice(0, 2)) {
  console.log("   " + Object.entries(r)
    .filter(([, v]) => String(v ?? "").trim() !== "")
    .map(([k, v]) => `${k}=${v}`)
    .join("  "));
}
