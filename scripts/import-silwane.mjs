// ═══════════════════════════════════════════════════════════
// IMPORT SILWANE → ADMEDCO — v2 « stock réel, fin de la démo »
// Source : exports CSV "ADMEDCO REEL" — E:\Massiexporte\*.csv
//   COM_ItemFamily (17)  → erp_familles
//   COM_Item (706)       → erp_articles  (+ typologie MP / semi-fini / fabriqué)
//   COM_ThirdParty (343) → erp_tiers
//   COM_Batch (706)      → erp_lots
//   COM_Formula (244) + COM_BOM (2315 utiles sur 5057) → erp_nomenclatures
//   ► NOUVEAU : erp_articles → stock_items (le stock VIVANT du MES)
//
// Usage :
//   1. Exécuter supabase/migrations/0015_stock_reel_silwane.sql
//   2. .env.local : NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
//   3. node scripts/import-silwane.mjs [chemin-exports] [--dry]
//
// Idempotent : upsert sur sil_oid (et sur code+dépôt pour le stock),
// ré-exécutable sans doublon. `--dry` compte sans rien écrire.
// ═══════════════════════════════════════════════════════════
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ARGS = process.argv.slice(2);
const DRY = ARGS.includes("--dry");
const DIR = resolve(ARGS.find((a) => !a.startsWith("--")) ?? "E:/Massiexporte");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!DRY && (!url || !key)) {
  console.error("❌ Manquant : NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (.env.local)");
  process.exit(1);
}
const db = DRY ? null : createClient(url, key, { auth: { persistSession: false } });

console.log(`\n📁 Exports : ${DIR}${DRY ? "   (mode --dry : aucune écriture)" : ""}\n`);

// ── CSV point-virgule → objets (gère les champs quotés "...") ──
function parseCsv(file) {
  const path = join(DIR, file);
  if (!existsSync(path)) {
    console.warn(`⚠️  absent, ignoré : ${file}`);
    return [];
  }
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
const nul = (v) => (v === "" || v == null ? null : v);

async function upsert(table, rows, onConflict, label) {
  if (DRY) { console.log(`   · ${label} : ${rows.length} ligne(s) à écrire`); return []; }
  if (!rows.length) { console.log(`   · ${label} : rien à importer`); return []; }
  const out = [];
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { data, error } = await db.from(table).upsert(chunk, { onConflict, ignoreDuplicates: false }).select("id,sil_oid");
    if (error) throw new Error(`${table} [lignes ${i + 1}-${i + chunk.length}] : ${error.message}`);
    out.push(...(data ?? []));
    process.stdout.write(`\r   · ${label} : ${Math.min(i + 500, rows.length)}/${rows.length}`);
  }
  console.log("");
  return out;
}

const mapOid = (rows) => new Map(rows.map((r) => [String(r.sil_oid), r.id]));

// ═══════════ 1. FAMILLES ═══════════
console.log("① Familles (COM_ItemFamily)…");
const families = parseCsv("COM_ItemFamily.csv");
const famRows = families
  .filter((f) => f.Oid)
  .map((f) => ({
    sil_oid: f.Oid,
    code: f.Label2?.trim() || `FAM-${f.Oid}`,
    nom: f.Label1?.trim() || `Famille ${f.Oid}`,
  }));
const seenCode = new Set();
const famUniq = famRows.filter((f) => (seenCode.has(f.code) ? false : (seenCode.add(f.code), true)));
const famUpserted = await upsert("erp_familles", famUniq, "code", "familles");
let famBySil = mapOid(famUpserted);
if (DRY && !famBySil.size) famBySil = new Map(famUniq.map((f) => [f.sil_oid, null]));

// ═══════════ 2. ARTICLES ═══════════
const items = parseCsv("COM_Item.csv");
console.log(`② Articles (COM_Item, ${items.length})…`);
const artRows = items
  .filter((a) => a.Oid)
  .map((a) => ({
    sil_oid: a.Oid,
    code: a.Code?.trim() || `ART-${a.Oid}`,
    designation: a.Label1?.trim() || a.Label2?.trim() || `Article ${a.Oid}`,
    famille_id: famBySil.get(String(a.Family)) ?? null,
    unite: a.UnitOfMeasure?.trim() || "pcs",
    prix_achat: num(a.VWAP),
    prix_vente: num(a.LPP) || num(a.MaxSP),
    // PhysicalQuantity vaut 0 pour TOUS les articles de l'export :
    // la quantité réelle est portée par LogicalQuantity. On garde les deux.
    stock_logique: num(a.LogicalQuantity),
    stock_physique: num(a.PhysicalQuantity),
    stock_reserve: num(a.ReservedQuantity),
    stock_min: num(a.QuantityMin),
    stock_max: num(a.QuantityMax),
    perissable: bool(a.IsPerishable),
    bloque: bool(a.Blocked),
    est_fabrique: bool(a.IsBOM),
    est_mp: bool(a.IsRawMaterial),
    est_semi_fini: bool(a.IsSemiFinished),
    sil_type: a.Type ?? "",
    tva: a.VAT ?? "",
    code_barres: a.Barcode ?? "",
    reference: a.Reference ?? "",
    emplacement: a.Location ?? "",
  }));
const artUpserted = await upsert("erp_articles", artRows, "sil_oid", "articles");
let artBySil = mapOid(artUpserted);
if (DRY && !artBySil.size) artBySil = new Map(artRows.map((a) => [a.sil_oid, null]));

// ═══════════ 3. TIERS ═══════════
const tiers = parseCsv("COM_ThirdParty.csv");
console.log(`③ Tiers (COM_ThirdParty, ${tiers.length})…`);
// Type Silwane : 0 = client, 1 = fournisseur — le reste → autre
const typeTiers = (t) => (t === "1" ? "fournisseur" : t === "0" ? "client" : "autre");
const tiersRows = tiers
  .filter((t) => t.Oid)
  .map((t) => {
    const pos = (name) => t[name] ?? "";
    return {
      sil_oid: t.Oid,
      code: pos("Code") || `T-${t.Oid}`,
      raison_sociale: pos("Label1")?.trim() || pos("Label2")?.trim() || `Tiers ${t.Oid}`,
      type_tiers: typeTiers(pos("Type")),
      telephone: pos("Tel1") || pos("Tel2") || "",
      adresse: [pos("Address1"), pos("Commune")].filter(Boolean).join(" — "),
      wilaya: pos("Department"),
      nif: pos("Value01") || pos("Num") || "",
    };
  });
await upsert("erp_tiers", tiersRows, "sil_oid", "tiers");

// ═══════════ 4. LOTS ═══════════
const batches = parseCsv("COM_Batch.csv");
console.log(`④ Lots (COM_Batch, ${batches.length} → DEP-MP)…`);
let depMp = null;
if (!DRY) {
  const { data: depots } = await db.from("erp_depots").select("id,code");
  depMp = (depots ?? []).find((d) => d.code === "DEP-MP")?.id ?? null;
}
const lotRows = batches
  .filter((b) => b.Oid && artBySil.has(String(b.Item)))
  .map((b) => ({
    sil_oid: b.Oid,
    article_id: artBySil.get(String(b.Item)),
    depot_id: depMp,
    numero_lot: b.BatchNum?.trim() || b.Code?.trim() || `LOT-${b.Oid}`,
    quantite: num(b.PhysicalQuantity) || num(b.LogicalQuantity),
    date_expiration: nul(b.ExpirationDate),
  }));
await upsert("erp_lots", lotRows, "sil_oid", "lots");

// ═══════════ 5. NOMENCLATURES ═══════════
const formulas = parseCsv("COM_Formula.csv");
const bom = parseCsv("COM_BOM.csv");
// COM_BOM.csv n'est PAS un fichier de 5057 lignes de nomenclature : 2742 de
// ses lignes sont du REMPLISSAGE PUR (`Oid;;Offset;…`, SyncId et tous les
// champs métier vides). Les annoncer comme des « lignes » laissait croire
// qu'on en perdait 2918 alors qu'il n'y en a que 2315 de réelles. On les
// écarte d'emblée, et on le DIT.
const estRemplissage = (b) =>
  String(b.SyncId ?? "").trim() === "" &&
  Object.entries(b).every(
    ([k, v]) => k === "Oid" || k === "Offset" || String(v ?? "").trim() === ""
  );
const nbRemplissage = bom.filter(estRemplissage).length;

console.log(
  `⑤ Nomenclatures (${formulas.length} formules + ${bom.length - nbRemplissage} lignes utiles` +
    `${nbRemplissage ? `, ${nbRemplissage} lignes de remplissage ignorées` : ""})…`
);

const formulaItem = new Map(); // Formula.Oid → { pfSilOid, code }
for (const f of formulas) {
  if (f.Oid && f.Item && artBySil.has(String(f.Item)))
    formulaItem.set(String(f.Oid), { pfSilOid: String(f.Item), code: f.Code?.trim() || `F-${f.Oid}` });
}

// Pour le rapport : Oid Silwane → code article lisible (COM_Item).
const codeParOid = new Map(items.map((a) => [String(a.Oid), a.Code?.trim() || `ART-${a.Oid}`]));

const nomenRows = [];
const orphelines = []; // lignes réelles SANS parent — jamais écartées en silence
// Composants consommés par au moins une ligne RATTACHÉE. Sert à séparer,
// dans le rapport, une orpheline sans conséquence d'une vraie perte.
const composantsRattaches = new Set();
for (let i = 0; i < bom.length; i++) {
  const b = bom[i];
  if (estRemplissage(b)) continue;
  const f = formulaItem.get(String(b.Formula));
  if (!f) {
    // `Formula` vide = aucun parent. Rien ne permet de deviner à quelle
    // nomenclature rattacher la ligne, et l'inventer fausserait la gamme
    // réelle. On la met de côté, on la compte, on l'écrit pour examen.
    orphelines.push({ ...b, __ligne: i + 2 }); // +2 : en-tête + base 1
    continue;
  }
  // `undefined` = article absent du catalogue ; `null` = mode --dry (id non résolu)
  const pfId = artBySil.get(f.pfSilOid);
  const compId = artBySil.get(String(b.Item));
  if (pfId === undefined || compId === undefined) continue;
  composantsRattaches.add(String(b.Item));
  nomenRows.push({
    sil_oid: b.Oid,
    code_formule: f.code,
    formule_sil_oid: String(b.Formula),
    article_id: pfId,
    composant_id: compId,
    quantite: num(b.Quantity) || 1,
  });
}

if (orphelines.length) {
  // Une orpheline n'est PAS forcément une perte : le relevé montre que la
  // plupart reprennent un composant qu'une ligne rattachée consomme déjà.
  // Le vrai signal, c'est une orpheline dont le composant n'apparaît dans
  // AUCUNE nomenclature importée — là, de la matière est bien perdue.
  const avecDetail = orphelines.map((b) => {
    const oid = String(b.Item);
    return {
      ligne: b.__ligne,
      oid: b.Oid,
      code: codeParOid.get(oid) ?? oid,
      quantite: String(b.Quantity).replace(",", "."),
      introuvableAilleurs: !composantsRattaches.has(oid),
    };
  });
  const perdues = avecDetail.filter((b) => b.introuvableAilleurs);
  // Les plus graves d'abord : le rapport s'ouvre sur ce qu'il faut regarder.
  const ordonnees = [...perdues, ...avecDetail.filter((b) => !b.introuvableAilleurs)];

  const RAPPORT = "nomenclature-orphelines.csv";
  writeFileSync(
    RAPPORT,
    String.fromCharCode(0xfeff) + // BOM : Excel Windows lit l'UTF-8 sans lui en ANSI
      [
        "ligne_csv;oid;code_composant;quantite;matiere_introuvable_ailleurs",
        ...ordonnees.map((b) =>
          [b.ligne, b.oid, b.code, b.quantite, b.introuvableAilleurs ? "OUI" : ""].join(";")
        ),
      ].join("\n") +
      "\n",
    "utf8"
  );

  console.log(
    `   ⚠️  ${orphelines.length} ligne(s) sans numéro de formule : parent inconnu,\n` +
      `      rattachement impossible sans risquer de fausser la gamme.`
  );
  if (perdues.length) {
    console.log(
      `      Dont ${perdues.length} portent une matière qu'AUCUNE autre nomenclature\n` +
        `      ne consomme — c'est la seule perte réelle :`
    );
    for (const b of perdues) {
      console.log(`         · ${b.code.padEnd(14)} qté ${b.quantite.padEnd(12)} (ligne CSV ${b.ligne})`);
    }
  } else {
    console.log(`      Aucune ne porte de matière absente ailleurs : aucune perte.`);
  }
  console.log(`      Détail complet : ${RAPPORT}`);
}
await upsert("erp_nomenclatures", nomenRows, "sil_oid", "lignes nomenclature");

// ═══════════ 6. STOCK VIVANT (NOUVEAU) ═══════════
// Le MES consomme `stock_items`. On y projette le catalogue réel :
//   matière première          → DEP-MP
//   produit fabriqué          → DEP-PF
//   acheté / consommable      → DEP-MP
// Aucune ligne de démo ne subsiste après 0015.
console.log("⑥ Stock vivant (erp_articles → stock_items)…");

const depotDe = (a) => (a.IsRawMaterial ? "DEP-MP" : a.IsBOM ? "DEP-PF" : "DEP-MP");
const storable = items.filter(
  (a) =>
    a.Oid &&
    a.Code?.trim() &&
    (bool(a.IsRawMaterial) || bool(a.IsSemiFinished) || bool(a.IsBOM) || num(a.LogicalQuantity) !== 0)
);

const stockRows = storable.map((a) => ({
  code: a.Code.trim(),
  name: a.Label1?.trim() || a.Label2?.trim() || `Article ${a.Oid}`,
  unit: a.UnitOfMeasure?.trim() || "pcs",
  quantity: num(a.LogicalQuantity),
  alert_threshold: num(a.QuantityMin) || 0,
  depot_code: depotDe(a),
  usine_code: "ADMEDCO",
  article_id: artBySil.get(String(a.Oid)) ?? null,
  prix_unitaire: num(a.VWAP),
  famille_nom: famRows.find((f) => f.sil_oid === String(a.Family))?.nom ?? "",
  is_demo: false,
}));

if (DRY) {
  const mp = stockRows.filter((r) => r.depot_code === "DEP-MP").length;
  const pf = stockRows.filter((r) => r.depot_code === "DEP-PF").length;
  const valorise = stockRows.reduce((s, r) => s + r.quantity * r.prix_unitaire, 0);
  console.log(`   · stock_items : ${stockRows.length} ligne(s) → DEP-MP ${mp}, DEP-PF ${pf}`);
  console.log(`   · valeur du stock : ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(valorise)} DA`);
} else {
  // Upsert manuel sur (code, dépôt, usine) : on lit l'existant puis on
  // sépare inserts / updates (plus sûr qu'un ON CONFLICT sur index partiel).
  const { data: existing } = await db
    .from("stock_items")
    .select("id,code,depot_code,usine_code")
    .not("code", "is", null)
    .limit(20000);
  const byKey = new Map((existing ?? []).map((r) => [`${r.code}|${r.depot_code}|${r.usine_code}`, r.id]));

  const toInsert = [];
  const toUpdate = [];
  for (const r of stockRows) {
    const id = byKey.get(`${r.code}|${r.depot_code}|${r.usine_code}`);
    if (id) toUpdate.push({ id, ...r });
    else toInsert.push(r);
  }

  for (let i = 0; i < toInsert.length; i += 500) {
    const { error } = await db.from("stock_items").insert(toInsert.slice(i, i + 500));
    if (error) throw new Error(`stock_items insert : ${error.message}`);
    process.stdout.write(`\r   · stock_items créés : ${Math.min(i + 500, toInsert.length)}/${toInsert.length}`);
  }
  if (toInsert.length) console.log("");

  for (let i = 0; i < toUpdate.length; i += 500) {
    const { error } = await db.from("stock_items").upsert(toUpdate.slice(i, i + 500), { onConflict: "id" });
    if (error) throw new Error(`stock_items update : ${error.message}`);
    process.stdout.write(`\r   · stock_items mis à jour : ${Math.min(i + 500, toUpdate.length)}/${toUpdate.length}`);
  }
  if (toUpdate.length) console.log("");

  // Ceinture de sécurité : toute ligne de stock restée sans code est une
  // ligne de démo jamais exploitée → on la sort du stock vivant.
  const { data: leftover } = await db.from("stock_items").select("id,code").is("code", null);
  const orphelins = (leftover ?? []).map((r) => r.id);
  if (orphelins.length) {
    await db.from("stock_items").update({ is_demo: true }).in("id", orphelins);

    // Une ligne de démo qui a déjà servi garde son historique : on ne
    // supprime que celles sans AUCUNE trace, sinon on effacerait un journal
    // d'audit (les mouvements partent en cascade avec la ligne).
    const [{ data: logs }, { data: movs }, { data: resas }] = await Promise.all([
      db.from("material_logs").select("stock_item_id").in("stock_item_id", orphelins),
      db.from("stock_movements").select("stock_item_id").in("stock_item_id", orphelins),
      db.from("order_item_reservations").select("stock_item_id").in("stock_item_id", orphelins),
    ]);
    const proteges = new Set([
      ...(logs ?? []).map((r) => r.stock_item_id),
      ...(movs ?? []).map((r) => r.stock_item_id),
      ...(resas ?? []).map((r) => r.stock_item_id),
    ]);
    const aSupprimer = orphelins.filter((id) => !proteges.has(id));
    if (aSupprimer.length) await db.from("stock_items").delete().in("id", aSupprimer);
    console.log(
      `   · lignes de démo : ${aSupprimer.length} supprimée(s), ` +
        `${proteges.size} conservée(s) car déjà utilisées (historique préservé)`
    );
  }
}

// ═══════════ 7. NETTOYAGE DES FAMILLES DE DÉMO ═══════════
if (!DRY) {
  const { data: famDemo } = await db.from("erp_familles").select("id,code").like("code", "FAM-%");
  const ids = (famDemo ?? []).map((f) => f.id);
  if (ids.length) {
    const { data: used } = await db.from("erp_articles").select("famille_id").in("famille_id", ids);
    const proteges = new Set((used ?? []).map((r) => r.famille_id));
    const aSupprimer = ids.filter((id) => !proteges.has(id));
    if (aSupprimer.length) {
      await db.from("erp_familles").delete().in("id", aSupprimer);
      console.log(`\n⑦ Familles de démo supprimées : ${aSupprimer.length} (${proteges.size} conservée(s) car utilisées)`);
    }
  }
}

console.log("\n✅ Import terminé.");
console.log("   Vérifiez : /admin/stocks · /admin/articles · /admin/tiers · /admin/nomenclatures · /admin/lots");
console.log("   SQL utile : SELECT code, COUNT(*) FROM stock_items WHERE is_demo = false GROUP BY code HAVING COUNT(*) > 1;\n");
