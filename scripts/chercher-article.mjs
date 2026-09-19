// ═══════════════════════════════════════════════════════════
// CHERCHER UN ARTICLE DANS LES EXPORTS SILWANE (lecture seule)
//
// Usage :
//   node scripts/chercher-article.mjs visiteur
//   node scripts/chercher-article.mjs "G 0 21" --code
//   node scripts/chercher-article.mjs --famille 12
//
// Le motif est comparé au CODE et à la DÉSIGNATION, sans tenir
// compte de la casse ni des espaces/points : Silwane écrit
// « G 0 21 », « G0.21 » ou « G021 » selon le champ, on veut les
// voir tous.
// ═══════════════════════════════════════════════════════════
import { resolve } from "node:path";
import { chargerSilwane, norm, DIR_DEFAUT } from "./silwane-csv.mjs";

const ARGS = process.argv.slice(2);
const iDir = ARGS.indexOf("--dir");
const DIR = resolve(iDir >= 0 ? ARGS[iDir + 1] : DIR_DEFAUT);
const iFam = ARGS.indexOf("--famille");
const FAMILLE = iFam >= 0 ? ARGS[iFam + 1] : null;
const CODE_SEUL = ARGS.includes("--code");
const reserves = new Set([iDir >= 0 ? iDir + 1 : -1, iFam >= 0 ? iFam + 1 : -1, -1]);
const MOTIF = ARGS.find((a, i) => !a.startsWith("--") && !reserves.has(i)) ?? "";

if (!MOTIF && FAMILLE === null) {
  console.error("Usage : node scripts/chercher-article.mjs <motif> [--code] [--famille N] [--dir chemin]");
  process.exit(1);
}

const ref = chargerSilwane(DIR);

const motifN = norm(MOTIF);
const trouves = ref.items.filter((a) => {
  if (FAMILLE !== null && String(a.Family) !== String(FAMILLE)) return false;
  if (!motifN) return true;
  if (CODE_SEUL) return norm(a.Code).includes(motifN);
  return norm(a.Code).includes(motifN) || norm(a.Label1).includes(motifN) || norm(a.Label2).includes(motifN);
});

console.log(`\n📁 ${DIR} — ${ref.items.length} articles`);
console.log(`🔎 motif « ${MOTIF} »${CODE_SEUL ? " (code seul)" : ""}${FAMILLE !== null ? ` · famille ${FAMILLE}` : ""} → ${trouves.length} résultat(s)\n`);

if (trouves.length === 0) {
  console.log("   Aucun article ne correspond.\n");
  process.exit(0);
}

console.log(`  ${"Oid".padStart(5)}  ${"Code".padEnd(14)} ${"Désignation".padEnd(34)} ${"Famille".padEnd(18)} ${"Formule".padEnd(9)} ${"Nb".padStart(3)}  ${"Type".padEnd(18)} Silo`);
console.log(`  ${"-".repeat(120)}`);
for (const a of trouves) {
  const f = ref.formuleParArticle.get(String(a.Oid));
  const nb = f ? (ref.lignesParFormule.get(String(f.Oid)) ?? []).length : 0;
  const type = a.IsRawMaterial === "t" ? "Matière première"
    : a.IsSemiFinished === "t" ? "Semi-fini"
    : a.IsBOM === "t" ? "Produit fabriqué" : "acheté/consommable";
  console.log(
    `  ${String(a.Oid).padStart(5)}  ${(a.Code || "—").padEnd(14)} ${(a.Label1 || "").slice(0, 33).padEnd(34)} ` +
      `${(ref.familleParOid.get(String(a.Family)) || "—").slice(0, 17).padEnd(18)} ${(f?.Code ?? "—").padEnd(9)} ` +
      `${String(nb).padStart(3)}  ${type.padEnd(18)} ${a.Location || ""}`
  );
}
console.log("");
