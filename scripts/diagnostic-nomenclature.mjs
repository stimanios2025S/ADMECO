// ═══════════════════════════════════════════════════════════
// COM_BOM.csv — QUE PERD RÉELLEMENT L'IMPORT ?
//
// Usage :
//   node scripts/diagnostic-nomenclature.mjs
//   node scripts/diagnostic-nomenclature.mjs --dir E:/Massiexporte
//
// ── Le symptôme ──
// `import-silwane.mjs --dry` annonce :
//     ⑤ Nomenclatures (244 formules + 5057 lignes)…
//        · lignes nomenclature : 2139 ligne(s) à écrire
// Il LIT 5057 lignes et n'en ÉCRIT que 2139, sans dire un mot des
// autres. On croit alors perdre 2918 lignes — 58 % de la
// nomenclature. Ce script mesure ce qui est vraiment perdu.
//
// ── Ce qu'il a trouvé ──
// Sur les 5057 lignes, 2742 sont du REMPLISSAGE : `Oid;;Offset;…`,
// tous les autres champs vides. Il ne reste que 2315 vraies lignes :
//   2139 portent un numéro de formule  → importées
//    176 n'en portent pas               → écartées
// La vraie question n'est donc pas « 2918 perdues » mais « ces 176
// sont-elles des lignes de matière, ou des doublons périmés ? »
//
// ── Réponse mesurée ──
// La grande majorité reprend un composant qu'une ligne RATTACHÉE
// consomme déjà : deux blocs orphelins consécutifs (Oids 2651-2658 et
// 2665-2672) sont même identiques, composant par composant.
// Mais quelques-unes portent une matière INTROUVABLE ailleurs — RALG
// (peinture poudre époxy), RFR160 (renfort), FRP505 et FRP40300
// (fers plats). Ce sont elles, et elles seules, qui sont une perte.
// Le verdict ci-dessous les nomme une par une.
//
// Lecture seule. Aucune base, aucune clé, aucune écriture.
// ═══════════════════════════════════════════════════════════
import { resolve } from "node:path";
import { parseCsv, DIR_DEFAUT } from "./silwane-csv.mjs";

const iDir = process.argv.indexOf("--dir");
const DIR = resolve(iDir >= 0 ? process.argv[iDir + 1] : DIR_DEFAUT);

const items = parseCsv(DIR, "COM_Item.csv");
const formulas = parseCsv(DIR, "COM_Formula.csv");
const bom = parseCsv(DIR, "COM_BOM.csv");

const artParOid = new Map(items.filter((a) => a.Oid).map((a) => [String(a.Oid), a]));
const formuleParOid = new Map(formulas.filter((f) => f.Oid).map((f) => [String(f.Oid), f]));
const nomArticle = (oid) => {
  const a = artParOid.get(String(oid));
  return a ? `${a.Code} — ${a.Label1 ?? ""}` : "(article inconnu)";
};

// ── 1. Trier les lignes du fichier ──
// Le remplissage se reconnaît à son SyncId vide ET à tous ses champs
// vides hormis Oid et Offset.
const estRemplissage = (r) => {
  if (String(r.SyncId ?? "").trim() !== "") return false;
  return Object.entries(r).every(
    ([k, v]) => k === "Oid" || k === "Offset" || String(v ?? "").trim() === ""
  );
};

const remplissage = bom.filter(estRemplissage);
const reelles = bom.filter((r) => !estRemplissage(r));
const avecFormule = reelles.filter((r) => String(r.Formula ?? "").trim() !== "");
const sansFormule = reelles.filter((r) => String(r.Formula ?? "").trim() === "");

const pc = (n) => `${((n / bom.length) * 100).toFixed(1)} %`;
console.log(`\n📁 ${DIR}`);
console.log(`   lignes dans COM_BOM.csv ......... ${bom.length}`);
console.log(`   dont REMPLISSAGE (champs vides) . ${remplissage.length}   ${pc(remplissage.length)}`);
console.log(`   vraies lignes ................... ${reelles.length}`);
console.log(`     ├─ avec numéro de formule ..... ${avecFormule.length}   → importées`);
console.log(`     └─ SANS numéro de formule ..... ${sansFormule.length}   → écartées`);
console.log(`\n   Ce que l'import annonce : 2139. Ici : ${avecFormule.length}.`);

// ── 2. Les 176 écartées : que sont-elles ? ──
console.log(`\n── LES ${sansFormule.length} LIGNES ÉCARTÉES ──`);

// 2a. Doublon exact (même composant, même quantité) d'une ligne gardée ?
const clesGardees = new Set(
  avecFormule.map((r) => `${String(r.Item).trim()}|${String(r.Quantity).trim()}`)
);
const doublons = sansFormule.filter((r) =>
  clesGardees.has(`${String(r.Item).trim()}|${String(r.Quantity).trim()}`)
);
console.log(
  `   doublons exacts d'une ligne gardée (même composant, même qté) : ` +
    `${doublons.length} / ${sansFormule.length}`
);

// 2b. Leur composant apparaît-il quelque part dans une ligne gardée ?
const composantsGardes = new Set(avecFormule.map((r) => String(r.Item).trim()));
const composantAilleurs = sansFormule.filter((r) => composantsGardes.has(String(r.Item).trim()));
console.log(
  `   dont le composant apparaît aussi dans une ligne gardée ....... : ` +
    `${composantAilleurs.length} / ${sansFormule.length}`
);

// 2c. Sont-elles toutes seules ? Un composant qui n'existe NULLE
//     PART ailleurs serait une vraie matière perdue.
const orphelines = sansFormule.filter((r) => !composantsGardes.has(String(r.Item).trim()));
console.log(
  `   composant absent de TOUTE ligne gardée ...................... : ${orphelines.length}`
);

// 2d. Distribution des composants écartés.
const parComposant = new Map();
for (const r of sansFormule) {
  const k = String(r.Item).trim();
  parComposant.set(k, (parComposant.get(k) ?? 0) + 1);
}
console.log(`   composants distincts concernés .............................. : ${parComposant.size}`);
console.log(`\n   Les 12 composants écartés les plus fréquents :`);
for (const [oid, n] of [...parComposant.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  const estMO = artParOid.get(oid) && /^MD\d+$/i.test(String(artParOid.get(oid).Code ?? "").trim());
  console.log(`      ${String(n).padStart(3)} ×  Oid ${oid.padEnd(6)} ${nomArticle(oid)}${estMO ? "   ← MAIN D'ŒUVRE" : ""}`);
}

// 2e. Signature d'ancienneté : les Oid des écartées sont-ils plus bas ?
const oids = (arr) => arr.map((r) => Number(r.Oid)).filter((n) => Number.isFinite(n));
const avec = oids(avecFormule);
const sans = oids(sansFormule);
const med = (t) => {
  const s = [...t].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};
console.log(`\n   Oid médian des lignes gardées : ${med(avec)}`);
console.log(`   Oid médian des lignes écartées : ${med(sans)}`);
console.log(
  `   Oid max des lignes gardées : ${Math.max(...avec)}  ·  des écartées : ${Math.max(...sans)}`
);

// ── 3. Verdict ──
console.log(`\n── VERDICT ──`);
if (orphelines.length === 0) {
  console.log(
    `   Aucun composant des lignes écartées n'est absent des lignes\n` +
      `   gardées. Ces ${sansFormule.length} lignes n'apportent donc AUCUNE matière\n` +
      `   que l'import ne couvre déjà : les écarter ne perd rien.`
  );
} else {
  console.log(
    `   ⚠️  ${orphelines.length} ligne(s) écartée(s) portent un composant introuvable\n` +
      `   ailleurs. Celles-là sont de la matière réellement perdue :`
  );
  for (const r of orphelines.slice(0, 20)) {
    console.log(`      Oid ${String(r.Oid).padEnd(6)} qté ${String(r.Quantity).padEnd(12)} ${nomArticle(r.Item)}`);
  }
  console.log(
    `\n   → il faut savoir à quelle formule ces lignes appartiennent\n` +
      `     AVANT de les importer, sinon elles seraient rattachées au hasard.`
  );
}
console.log("");
