// ═══════════════════════════════════════════════════════════
// RÉPARTITION DES ARTICLES PAR FAMILLE — lecture seule, CSV uniquement
// Usage : node scripts/familles-silwane.mjs [chemin-exports] [filtre]
//
// Sert à trancher une question d'atelier : « qu'est-ce qui est vraiment
// du bureau, qu'est-ce qui est vraiment de la tôle ? » — en montrant les
// désignations réelles, pas seulement des compteurs.
// ═══════════════════════════════════════════════════════════
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const DIR = resolve(process.argv[2] ?? "E:/Massiexporte");
const FILTRE = (process.argv[3] ?? "").toLowerCase();
const EXEMPLES = Number(process.argv[4]) || 8;

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

const familles = parseCsv("COM_ItemFamily.csv");
const items = parseCsv("COM_Item.csv");

// Label1 = nom de la famille · Label2 = code hiérarchique (VIDE pour BOIS DIVERS)
const libelle = new Map(
  familles.filter((f) => f.Oid).map((f) => [String(f.Oid), `${f.Label1} [${f.Label2 || "sans code"}]`])
);

const parFamille = new Map();
for (const a of items) {
  if (!a.Oid) continue;
  const k = libelle.get(String(a.Family)) ?? `? famille ${a.Family} inconnue`;
  if (!parFamille.has(k)) parFamille.set(k, []);
  parFamille.get(k).push(a);
}

const tri = [...parFamille].sort((a, b) => b[1].length - a[1].length);
const total = items.filter((a) => a.Oid).length;

console.log(`\n📁 ${DIR}`);
console.log(`   ${total} articles répartis en ${tri.length} familles\n` + "═".repeat(78));

for (const [famille, arts] of tri) {
  if (FILTRE && !famille.toLowerCase().includes(FILTRE)) continue;
  const mp = arts.filter((a) => a.IsRawMaterial === "t").length;
  const pf = arts.filter((a) => a.IsBOM === "t").length;
  const semi = arts.filter((a) => a.IsSemiFinished === "t").length;
  const valorise = arts.reduce((s, a) => s + (Number(a.LogicalQuantity) || 0) * (Number(a.VWAP) || 0), 0);
  const sansPrix = arts.filter((a) => !(Number(a.VWAP) > 0)).length;

  console.log(`\n▸ ${famille}  —  ${arts.length} articles`);
  console.log(
    `   MP ${String(mp).padStart(3)} · fabriqué ${String(pf).padStart(3)} · semi-fini ${String(semi).padStart(3)}` +
      ` · valeur ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(valorise)} DA`
  );
  if (sansPrix === arts.length) console.log(`   ⚠️  aucun prix (VWAP) sur les ${arts.length} articles`);

  for (const a of arts.slice(0, EXEMPLES)) {
    const d = (a.Label1 || a.Label2 || "").slice(0, 56);
    console.log(`     ${a.Code.padEnd(14)} ${d}`);
  }
  if (arts.length > EXEMPLES) console.log(`     … et ${arts.length - EXEMPLES} autres`);
}
console.log("");
