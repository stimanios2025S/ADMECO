// ═══════════════════════════════════════════════════════════
// APERÇU DES GAMMES — LECTURE SEULE, N'ÉCRIT NULLE PART
// Usage : node scripts/preview-gammes-silwane.mjs [chemin-exports] [fichier-sortie]
// Défaut : E:/Massiexporte  →  gammes-preview.md
//
// MODÈLE D'USINE (donné par le client) :
//   Atelier 1 (ADMEDCO) — le LOURD / la TÔLE
//   Atelier 2 (ADMEDCO) — le BUREAU
//   Atelier 3 (ADMEDCO, id 4) — POUDrage + EMBALLAGE, pour les DEUX
//   MOBILIX — usine séparée
//
// D'OÙ VIENNENT LES ÉTAPES — deux sources, dans cet ordre :
//
//   ① GAMME ÉCRITE (fiable). Silwane n'a pas de table de gamme, MAIS sa
//      nomenclature contient des articles de MAIN D'ŒUVRE qui NOMMENT
//      l'opération :
//          MD001 MAIN D'OEUVRE PREPARATION
//          MD002 MAIN D'OEUVRE SOUDAGE
//          MD003 MAIN D'OEUVRE POUDRAGE
//          MD004 MAIN D'OEUVRE EMBALLAGE ET MONTAGE
//          MD005 MAIN D'OEUVRE CACHE JUPE
//          SDMF005 / SDLZ004 / SCH0003  SOUS TRAITANCE …
//      199 des 244 produits (82 %) portent cette information. Pour ceux-là
//      la gamme est LUE, pas devinée.
//
//   ② GAMME DÉDUITE (repli, 45 produits). Les familles de matières sont
//      trop bruitées pour porter seules la décision : la famille « TOLE »
//      ne contient qu'UN article, « PEINTURE » en contient 2 (un embout de
//      pistolet et une peinture dorée), et 215 articles — l'acier, les
//      boulons ET la poudre époxy — sont tous dans la famille générique
//      « MATIERE PREMIERE ». Le repli sert donc de filet, pas de moteur.
//
// Ordre tranché par l'exploitant : ON POUDRE AVANT DE MONTER (voir
// ORDRE_MONTAGE ci-dessous), d'où un aller-retour A3 → A2 → A3 assumé.
// ═══════════════════════════════════════════════════════════
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const DIR = resolve(process.argv[2] ?? "E:/Massiexporte");
const OUT = resolve(process.argv[3] ?? "gammes-preview.md");

// ═══════════════════════════════════════════════════════════
// ① ATELIERS — `dbId` = work_order_steps.atelier_id
// ═══════════════════════════════════════════════════════════
const ATELIERS = {
  1: { dbId: 1, code: "A1", nom: "Atelier 1 — Tôle & Gros œuvre", court: "A1" },
  2: { dbId: 2, code: "A2", nom: "Atelier 2 — Bureau", court: "A2" },
  4: { dbId: 4, code: "A3", nom: "Atelier 3 — Poudrage & Emballage", court: "A3" },
  3: { dbId: 3, code: "M1", nom: "MOBILIX — Réception & Finition", court: "MBX" },
};
const prod = (a) => (a === 3 ? 2 : a === 4 ? 3 : a); // id base → numéro affiché

// ═══════════════════════════════════════════════════════════
// ② ORDONNANCEMENT — LA SEULE VRAIE INCONNUE
//    Physiquement on soude AVANT de poudrer (on ne poudre pas une pièce
//    qu'on va encore chauffer) et on emballe APRÈS avoir monté.
//    Reste à savoir si le montage (A2) se fait avant ou après le poudrage.
//
//      "avant"  →  A1 …  → A2 (montage) → A3 (poudrage) → A3 (emballage)
//      "apres"  →  A1 …  → A3 (poudrage) → A2 (montage) → A3 (emballage)
//
//    ✅ TRANCHÉ PAR L'EXPLOITANT : « poudrer AVANT de monter » → "apres".
//    On n'assemble pas du skaï et de la mousse sur une pièce qui doit encore
//    passer au four. Le surcoût est un aller-retour A3 → A2 → A3, assumé.
// Surchargeable en ligne de commande :  --avant-montage | --apres-montage
const ORDRE_MONTAGE = process.argv.includes("--avant-montage") ? "avant"
  : process.argv.includes("--apres-montage") ? "apres"
  : "apres"; // "avant" | "apres" — défaut = décision exploitant

const ORDRE = {
  A1: { PREPARATION: 10, SOUDAGE: 20, CACHE_JUPE: 30, DECOUPE_MDF: 40, DECOUPE_LASER: 50, CHROMAGE_PRE: 60 },
  A2: ORDRE_MONTAGE === "avant" ? { MONTAGE: 70 } : { MONTAGE: 90 },
  A3: ORDRE_MONTAGE === "avant"
    ? { POUDRAGE: 80, CHROMAGE: 85, EMBALLAGE: 100 }
    : { POUDRAGE: 70, CHROMAGE: 75, EMBALLAGE: 100 },
};

// ═══════════════════════════════════════════════════════════
// ③ CATALOGUE DES OPÉRATIONS
// ═══════════════════════════════════════════════════════════
const OPERATIONS = {
  PREPARATION:   { nom: "Débit & Préparation",           atelier: 1, ordre: ORDRE.A1.PREPARATION,   icone: "🪚" },
  SOUDAGE:       { nom: "Soudage",                       atelier: 1, ordre: ORDRE.A1.SOUDAGE,       icone: "⚡" },
  CACHE_JUPE:    { nom: "Façonnage cache-jupe",          atelier: 1, ordre: ORDRE.A1.CACHE_JUPE,    icone: "🪟" },
  DECOUPE_MDF:   { nom: "Découpe MDF (sous-traitance)",  atelier: 1, ordre: ORDRE.A1.DECOUPE_MDF,   icone: "🪵" },
  DECOUPE_LASER: { nom: "Découpe laser (sous-traitance)",atelier: 1, ordre: ORDRE.A1.DECOUPE_LASER, icone: "🔺" },
  CHROMAGE:      { nom: "Chromage (sous-traitance)",     atelier: 4, ordre: ORDRE.A3.CHROMAGE,      icone: "✨" },
  POUDRAGE:      { nom: "Poudrage",                      atelier: 4, ordre: ORDRE.A3.POUDRAGE,      icone: "🎨" },
  MONTAGE:       { nom: "Montage",                       atelier: 2, ordre: ORDRE.A2.MONTAGE,       icone: "🪑" },
  EMBALLAGE:     { nom: "Emballage",                     atelier: 4, ordre: ORDRE.A3.EMBALLAGE,     icone: "📦" },
};

// ═══════════════════════════════════════════════════════════
// ④ SOURCE ① — LES LIBELLÉS DE MAIN D'ŒUVRE QUI NOMMENT L'OPÉRATION
// ═══════════════════════════════════════════════════════════
const REGLES_OPERATION = [
  { motif: /MAIN\s*D'?[OE]{1,2}UVRE\s+SOUDAGE/i,             ops: ["SOUDAGE"] },
  { motif: /MAIN\s*D'?[OE]{1,2}UVRE\s+POUDRAGE/i,            ops: ["POUDRAGE"] },
  { motif: /MAIN\s*D'?[OE]{1,2}UVRE\s+EMBALLAGE/i,           ops: ["MONTAGE", "EMBALLAGE"] },
  { motif: /MAIN\s*D'?[OE]{1,2}UVRE\s+PREPARATION/i,         ops: ["PREPARATION"] },
  { motif: /MAIN\s*D'?[OE]{1,2}UVRE\s+CACHE\s*JUPE/i,        ops: ["CACHE_JUPE"] },
  { motif: /SOUS\s*TRAITANCE\s+DECOUPE\s+MDF/i,              ops: ["DECOUPE_MDF"] },
  { motif: /SOUS\s*TRAITANCE\s+DECOUPE\s+LASER/i,            ops: ["DECOUPE_LASER"] },
  { motif: /SOUS\s*TRAITANCE\s+CHROMAGE/i,                   ops: ["CHROMAGE"] },
  { motif: /^ECO\s+(ASSAMBLAGE|ASSEMBLAGE|VISSAGE)/i,        ops: ["MONTAGE"] },
  { motif: /^ECO\s+(COUPE|COP)/i,                            ops: ["PREPARATION"] },
];
// Un article est « opératoire » dès que son libellé ressemble à une
// main d'œuvre / sous-traitance, même si aucune règle ne le capte
// (il sera alors signalé comme opération non mappée).
const EST_OPERATOIRE = /MAIN\s*D'?[OE]{1,2}UVRE|SOUS\s*TRAITANCE|^ECO\s/i;

// ═══════════════════════════════════════════════════════════
// ⑤ SOURCE ② — REPLI : FAMILLE DE MATIÈRE → OPÉRATIONS
//    Clés = colonne Label2 de COM_ItemFamily.csv. Label1 porte le NOM.
// ═══════════════════════════════════════════════════════════
const FAMILLE_OPERATIONS = {
  "002-004": ["SOUDAGE"],   // TOLE (1 article en base) — tôle
  "002-006": ["SOUDAGE"],   // METAL (11 articles, souvent mal classés)
  "002-007": [],            // TAPISSAGE — mousse, skaï → plutôt MOBILIX
  "002-003": [],            // PLASTIQUE — embouts, inserts : consommés, pas fabriqués
  "002-005": [],            // CANQUAIRIE — quincaillerie EN STOCK (confirmé client)
  "002-008": [],            // PEINTURE — consommables (pistolet, peinture dorée)
  "002-009": [],            // MAIN D'OUVRE — capté par les règles ci-dessus
  "002":     ["PREPARATION"], // MATIERE PREMIERE générique — acier, tubes, boulons
  "":        ["PREPARATION"], // BOIS DIVERS — Label2 vide en base, d'où la clé ""
  "001":     [],            // PRODUITS SEMI-FINI — déjà fabriqués ailleurs
};

const FAMILLES_PRODUIT = new Set(["010", "010-011", "010-012", "010-013", "010-014", "010-015"]);
const FAMILLE_SERVICE = "016";
const FAMILLE_RACINE_MP = "002";

// Le client n'a pas encore tranché : à quelle famille de PRODUIT
// appartiennent ces gammes ? `null` = signalé, jamais deviné.
const PRODUIT_ATELIER = {
  "010-013": 1,     // PIETEMENTS
  "010-014": 1,     // STRUCTURES
  "010-015": 2,     // MOBILIER BUREAU
  "010-011": null,  // CACHE JUPES — À CONFIRMER
  "010-012": null,  // CHAISE — À CONFIRMER
  "010":     null,  // PRODUIT FINI — À CONFIRMER
  "001":     null,  // PRODUITS SEMI-FINI — À CONFIRMER
};

const MAX_COMPOSANTS = 200; // garde-fou : une formule réelle a 2918 lignes

// ── Lecture CSV point-virgule ──
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

console.log(`\n📁 Exports : ${DIR}`);

const items = parseCsv("COM_Item.csv");
const families = parseCsv("COM_ItemFamily.csv");
const formulas = parseCsv("COM_Formula.csv");
const bom = parseCsv("COM_BOM.csv");

const itemByOid = new Map(items.filter((i) => i.Oid).map((i) => [String(i.Oid), i]));
const famNomByOid = new Map(families.filter((f) => f.Oid).map((f) => [String(f.Oid), (f.Label1 || "").trim()]));
const famCodeByOid = new Map(families.filter((f) => f.Oid).map((f) => [String(f.Oid), (f.Label2 || "").trim()]));
const famOidParCode = new Map([...famCodeByOid].map(([oid, code]) => [code, oid]));

const nomFamille = (code) => famNomByOid.get(famOidParCode.get(code)) ?? (code || "(sans code)");
const familleDe = (oid) => {
  const a = itemByOid.get(String(oid));
  return a ? (famCodeByOid.get(String(a.Family)) ?? "") : "";
};
const libelleDe = (oid) => (itemByOid.get(String(oid))?.Label1 || "").trim();
const codeDe = (oid) => (itemByOid.get(String(oid))?.Code || "").trim();

const composantsParFormule = new Map();
for (const b of bom) {
  const k = String(b.Formula ?? "");
  if (!k) continue;
  if (!composantsParFormule.has(k)) composantsParFormule.set(k, []);
  composantsParFormule.get(k).push(String(b.Item ?? ""));
}

// ── Déduction ──
function deduireGamme(composants, codeFamilleProduit) {
  const ops = new Set();
  const notes = [];
  const nommees = [];              // opérations LUES dans la nomenclature
  const famillesVues = new Map();

  for (const oid of composants) {
    const lib = libelleDe(oid);
    const code = familleDe(oid);
    if (code) famillesVues.set(code, (famillesVues.get(code) ?? 0) + 1);

    // ① GAMME ÉCRITE — l'article nomme l'opération
    if (EST_OPERATOIRE.test(lib)) {
      const regle = REGLES_OPERATION.find((r) => r.motif.test(lib));
      if (!regle) {
        notes.push(`opération « ${codeDe(oid)} ${lib} » non mappée — étape ignorée`);
        continue;
      }
      for (const op of regle.ops) {
        if (!ops.has(op)) nommees.push({ op, source: lib });
        ops.add(op);
      }
      continue; // une main d'œuvre n'est pas une matière : pas de repli famille
    }
  }

  // ② REPLI — seulement si la nomenclature ne nomme RIEN
  const ecrite = ops.size > 0;
  if (!ecrite) {
    for (const [code, nb] of famillesVues) {
      if (FAMILLES_PRODUIT.has(code) || code === FAMILLE_SERVICE) continue;
      const liste = FAMILLE_OPERATIONS[code];
      if (liste === undefined) {
        notes.push(`famille non mappée « ${nomFamille(code)} » (${code}, ${nb} ligne(s)) — étape ignorée`);
        continue;
      }
      for (const op of liste) ops.add(op);
    }
  }

  // L'emballage est systématique en atelier 3
  if (!ops.has("EMBALLAGE")) { ops.add("EMBALLAGE"); nommees.push({ op: "EMBALLAGE", source: "ajouté (sortie de gamme)" }); }

  const gamme = [...ops]
    .map((code) => ({ code, ...OPERATIONS[code] }))
    .filter((o) => o.nom)
    .sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom));

  return { gamme, famillesVues, notes, ecrite, nommees, atelierProduit: PRODUIT_ATELIER[codeFamilleProduit] };
}

// ═══════════ CALCUL ═══════════
const lignes = [];
const anomalies = [];
const impactFamille = new Map();
let ecrites = 0, deduites = 0, atelierIndetermine = 0;

for (const f of formulas) {
  if (!f.Oid || !f.Item) continue;
  const produit = itemByOid.get(String(f.Item));
  if (!produit) { anomalies.push(`Formule ${f.Oid} : produit ${f.Item} introuvable`); continue; }

  const composants = composantsParFormule.get(String(f.Oid)) ?? [];
  if (composants.length === 0) { anomalies.push(`Formule ${f.Code || f.Oid} : aucune ligne BOM`); continue; }
  if (composants.length > MAX_COMPOSANTS) {
    anomalies.push(`🚨 ${codeDe(f.Item)} : ${composants.length} composants — nomenclature suspecte, gamme NON déduite (plafond ${MAX_COMPOSANTS})`);
    continue;
  }

  const codeFamilleProduit = famCodeByOid.get(String(produit.Family)) ?? "";
  const r = deduireGamme(composants, codeFamilleProduit);
  r.ecrite ? ecrites++ : deduites++;
  for (const n of r.notes) anomalies.push(`${codeDe(f.Item)} : ${n}`);
  if (r.atelierProduit == null && FAMILLES_PRODUIT.has(codeFamilleProduit)) atelierIndetermine++;

  for (const code of r.famillesVues.keys()) {
    if (FAMILLES_PRODUIT.has(code) || code === FAMILLE_SERVICE) continue;
    impactFamille.set(code, (impactFamille.get(code) ?? 0) + 1);
  }

  lignes.push({
    code: codeDe(f.Item),
    designation: (produit.Label1 || produit.Label2 || "").trim(),
    famille: nomFamille(codeFamilleProduit),
    codeFamilleProduit,
    atelierProduit: r.atelierProduit,
    ecrite: r.ecrite,
    nommees: r.nommees,
    nbComposants: composants.length,
    // TAPISSAGE (002-007) = mousse, skaï, compacton → interdit le passage au four
    famillesGarnissage: r.famillesVues.has("002-007"),
    gamme: r.gamme,
    // Séquence RÉELLE des ateliers, répétitions comprises : un produit qui
    // poudre, part se faire monter, puis revient emballer fait bien
    // « A1 → A3 → A2 → A3 ». Dédupliquer ici masquerait l'aller-retour.
    ateliers: r.gamme.map((g) => g.atelier),
  });
}

lignes.sort((a, b) => Number(a.ecrite) - Number(b.ecrite) || b.nbComposants - a.nbComposants);

// ═══════════ RAPPORT ═══════════
// Regroupe les étapes consécutives d'un même atelier (A1×3 = trois postes
// dans le même bâtiment, ce n'est PAS un déplacement). Une flèche ⤾ marque
// un vrai RETOUR : l'atelier avait été quitté puis on y revient.
const fmtParcours = (ids) => {
  const runs = [];
  for (const i of ids) {
    const dernier = runs[runs.length - 1];
    if (dernier && dernier.id === i) dernier.n++;
    else runs.push({ id: i, n: 1 });
  }
  const vus = new Set();
  return runs.map((r) => {
    const retour = vus.has(r.id);
    vus.add(r.id);
    const nom = ATELIERS[r.id]?.court ?? `#${r.id}`;
    return `${retour ? "⤾" : ""}${nom}${r.n > 1 ? `×${r.n}` : ""}`;
  }).join(" → ");
};
// Y a-t-il un aller-retour entre bâtiments ? (critère de choix d'ordonnancement)
const aUnRetour = (ids) => {
  const vus = new Set();
  let precedent = null;
  for (const i of ids) {
    if (i !== precedent && vus.has(i)) return true;
    vus.add(i); precedent = i;
  }
  return false;
};
const md = [];
md.push("# Aperçu des gammes — Ateliers ADMEDCO");
md.push("");
md.push(`> Généré depuis \`${DIR}\` — **aucune écriture en base**.`);
md.push(`> ${lignes.length} produits · ${ecrites} gammes ÉCRITES dans la nomenclature · ${deduites} déduites · ${anomalies.length} anomalie(s).`);
md.push("");
md.push("## 1. Modèle d'usine");
md.push("");
md.push("| Atelier | id en base | Rôle |");
md.push("|---|---|---|");
for (const [, a] of Object.entries(ATELIERS)) md.push(`| ${a.code} | \`${a.dbId}\` | ${a.nom} |`);
md.push("");
md.push("> ⚠️ L'id `3` est déjà MOBILIX en base : le nouvel atelier poudrage prend l'id `4`.");
md.push("");
md.push("## 2. D'où viennent les étapes");
md.push("");
md.push("| Source | Nb produits | Fiabilité |");
md.push("|---|---|---|");
md.push(`| ① Gamme ÉCRITE (articles de main d'œuvre dans la nomenclature) | ${ecrites} | Lue, pas devinée |`);
md.push(`| ② Gamme DÉDUITE (repli sur les familles de matières) | ${deduites} | Approximation |`);
md.push("");
md.push("## 3. Gammes déduites");
md.push("");
md.push("| Produit | Désignation | Famille | Source | Comp. | Gamme proposée |");
md.push("|---|---|---|---|---|---|");
for (const l of lignes) {
  const gamme = l.gamme.map((g) => `${g.icone}${g.nom} (${ATELIERS[g.atelier].court})`).join(" → ");
  md.push(`| \`${l.code}\` | ${l.designation} | ${l.famille} | ${l.ecrite ? "écrite" : "déduite"} | ${l.nbComposants} | ${gamme || "—"} |`);
}
md.push("");
md.push("## 4. Anomalies");
md.push("");
for (const a of anomalies) md.push(`- ${a}`);
md.push("");
writeFileSync(OUT, md.join("\n"), "utf8");

// ═══════════ CONSOLE ═══════════
console.log(`\n① Modèle d'usine`);
console.log("   " + "─".repeat(74));
for (const [, a] of Object.entries(ATELIERS)) console.log(`   ${a.court.padEnd(4)} id=${String(a.dbId).padEnd(3)} ${a.nom}`);

console.log(`\n② Source des gammes`);
console.log("   " + "─".repeat(74));
console.log(`   ① ÉCRITE dans la nomenclature : ${String(ecrites).padStart(3)} produits`);
console.log(`   ② DÉDUITE des familles       : ${String(deduites).padStart(3)} produits`);
console.log(`   (ordre retenu : poudrage ${ORDRE_MONTAGE === "apres" ? "AVANT" : "APRÈS"} le montage — ${
  ORDRE_MONTAGE === "apres" ? "A1 → A3 poudrage → A2 montage → A3 emballage" : "A1 → A2 montage → A3 poudrage → A3 emballage"
})`);

const opCount = new Map();
for (const l of lignes) for (const g of l.gamme) opCount.set(g.code, (opCount.get(g.code) ?? 0) + 1);
console.log(`\n③ Opérations retenues`);
console.log("   " + "─".repeat(74));
for (const [code, o] of Object.entries(OPERATIONS).sort((a, b) => a[1].ordre - b[1].ordre))
  console.log(`   ${o.icone} ${o.nom.padEnd(34)} ${String(opCount.get(code) ?? 0).padStart(4)} prod.   ${ATELIERS[o.atelier].court}`);

const parParcours = new Map();
for (const l of lignes) { const k = fmtParcours(l.ateliers); parParcours.set(k, (parParcours.get(k) ?? 0) + 1); }
console.log(`\n④ Parcours entre ateliers — le cœur du modèle`);
console.log("   " + "─".repeat(74));
for (const [k, c] of [...parParcours].sort((a, b) => b[1] - a[1])) console.log(`   ${String(c).padStart(4)} produits : ${k}`);
const avecRetour = lignes.filter((l) => aUnRetour(l.ateliers)).length;
console.log(`\n   ⤾ Aller-retour A3 → A2 → A3 : ${avecRetour} produit(s)`);
console.log(ORDRE_MONTAGE === "apres"
  ? `      ← CONSÉQUENCE ASSUMÉE de « poudrer avant de monter ». Le surcoût est\n`
  + `        la double manutention A3 ; l'alternative ferait passer la mousse au four.`
  : `      ← remonter le poudrage AVANT le montage supprime ces retours (option "apres").`);

const nonMappees = [...impactFamille.keys()].filter((c) => FAMILLE_OPERATIONS[c] === undefined);
if (nonMappees.length) {
  console.log(`\n⑤ Familles vues mais NON mappées (étapes perdues en repli)`);
  console.log("   " + "─".repeat(74));
  for (const c of nonMappees) console.log(`   ${nomFamille(c)} (${c}) — ${impactFamille.get(c)} produits`);
}

// ── Points de contrôle ──
// Le montage peut-il vraiment précéder le poudrage ? Un produit garni de
// mousse ou de skaï ne passe pas au four : si sa gamme monte avant de
// poudrer, c'est incohérent.
const aPoudrage = (l) => l.gamme.some((g) => g.code === "POUDRAGE");
const aMontage = (l) => l.gamme.some((g) => g.code === "MONTAGE");
const garnis = lignes.filter((l) => l.gamme.some((g) => g.code === "MONTAGE") && l.famillesGarnissage);
const sansGamme = lignes.filter((l) => l.gamme.length <= 1);

console.log(`\n⑥ Points de contrôle`);
console.log("   " + "─".repeat(74));
console.log(`   Produits avec poudrage           : ${lignes.filter(aPoudrage).length}`);
console.log(`   Produits avec montage            : ${lignes.filter(aMontage).length}`);
console.log(`   ⚠️  Montage + garnissage (mousse/skaï) : ${garnis.length}` +
  (garnis.length ? `\n        → poudrer APRÈS les avoir garnis passerait la mousse au four` : ""));
console.log(`   ⚠️  Gammes quasi vides (≤ 1 étape)     : ${sansGamme.length}  → à revoir à la main`);
for (const l of sansGamme.slice(0, 5)) console.log(`        ${l.code} — ${l.designation.slice(0, 46)}`);

console.log(`\n⑦ Échantillon — gamme ÉCRITE`);
console.log("   " + "─".repeat(74));
for (const l of lignes.filter((x) => x.ecrite).slice(0, 4)) {
  console.log(`   ${l.code} — ${l.designation.slice(0, 44)}`);
  console.log(`      ${l.gamme.map((g) => `${g.icone}${g.nom}[${ATELIERS[g.atelier].court}]`).join(" → ")}`);
}
console.log(`\n📄 Rapport complet : ${OUT}\n`);
