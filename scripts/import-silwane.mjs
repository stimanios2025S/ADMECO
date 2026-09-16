// ═══════════════════════════════════════════════════════════
// IMPORT SILWANE → ADMEDCO (produit final, fini la démo)
// Source : exports CSV "ADMEDCO REEL" — E:\Massiexporte\*.csv
//   COM_ItemFamily (17) → erp_familles
//   COM_Item (767)      → erp_articles (+est_fabrique, sil_type, tva)
//   COM_ThirdParty (459) → erp_tiers
//   COM_Batch (706)     → erp_lots
//   COM_Formula (257) + COM_BOM (5057) → erp_nomenclatures
//
// Usage :
//   1. Exécuter supabase/migrations/0011_silwane_import.sql dans Supabase
//   2. .env.local : NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
//   3. node scripts/import-silwane.mjs [chemin-exports]
// Idempotent : upsert sur sil_oid → ré-exécutable sans doublons.
// ═══════════════════════════════════════════════════════════
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const DIR = resolve(process.argv[2] ?? "E:/Massiexporte");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("❌ Manquant : NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (.env.local)");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

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
// Déduplique sur le code (Label2 peut se répéter)
const seenCode = new Set();
const famUniq = famRows.filter((f) => (seenCode.has(f.code) ? false : (seenCode.add(f.code), true)));
await upsert("erp_familles", famUniq, "code", "familles");
const { data: famDb } = await db.from("erp_familles").select("id,sil_oid");
const famBySil = mapOid(famDb ?? []);

// ═══════════ 2. ARTICLES ═══════════
console.log("② Articles (COM_Item, 767)…");
const items = parseCsv("COM_Item.csv");
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
    stock_logique: num(a.LogicalQuantity),
    stock_reserve: num(a.ReservedQuantity),
    stock_min: num(a.QuantityMin),
    stock_max: num(a.QuantityMax),
    perissable: bool(a.IsPerishable),
    bloque: bool(a.Blocked),
    est_fabrique: bool(a.IsBOM),
    sil_type: a.Type ?? "",
    tva: a.VAT ?? "",
    code_barres: a.Barcode ?? "",
  }));
await upsert("erp_articles", artRows, "sil_oid", "articles");
const { data: artDb } = await db.from("erp_articles").select("id,sil_oid");
const artBySil = mapOid(artDb ?? []);

// ═══════════ 3. TIERS ═══════════
console.log("③ Tiers (COM_ThirdParty, 459)…");
// Type Silwane : 0 = client/particulier, 1 = fournisseur — le reste → autre
const typeTiers = (t) => (t === "1" ? "fournisseur" : t === "0" ? "client" : "autre");
const tiers = parseCsv("COM_ThirdParty.csv");
// Détecte les colonnes d'adresse/wilaya/nif par position grâce à l'en-tête réelle
const tiersRows = tiers
  .filter((t) => t.Oid)
  .map((t) => {
    const keys = Object.keys(t);
    const pos = (name) => t[name] ?? "";
    return {
      sil_oid: t.Oid,
      code: pos("Code") || `T-${t.Oid}`,
      raison_sociale: pos("Label1")?.trim() || pos("Label2")?.trim() || `Tiers ${t.Oid}`,
      type_tiers: typeTiers(pos("Type")),
      telephone: pos("Tel1") || pos("Tel2") || "",
      // Adresse1/Adresse2 + Commune/Department (noms exacts de l'en-tête)
      adresse: [pos("Address1"), keys.includes("Commune") ? pos("Commune") : ""].filter(Boolean).join(" — "),
      wilaya: keys.includes("Department") ? pos("Department") : "",
      nif: pos("Value01") || pos("Num") || "",
    };
  });
await upsert("erp_tiers", tiersRows, "sil_oid", "tiers");

// ═══════════ 4. LOTS ═══════════
console.log("④ Lots (COM_Batch, 706 → DEP-MP)…");
const { data: depots } = await db.from("erp_depots").select("id,code");
const depMp = (depots ?? []).find((d) => d.code === "DEP-MP")?.id ?? null;
const batch = parseCsv("COM_Batch.csv");
const lotRows = batch
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

// ═══════════ 5. NOMENCLATURES (formules + BOM) ═══════════
console.log("⑤ Nomenclatures (COM_Formula 257 + COM_BOM 5057)…");
const formulas = parseCsv("COM_Formula.csv");
const bom = parseCsv("COM_BOM.csv");
const formulaItem = new Map(); // Formula.Oid → { pfSilOid, code }
for (const f of formulas) {
  if (f.Oid && f.Item && artBySil.has(String(f.Item)))
    formulaItem.set(String(f.Oid), { pfSilOid: String(f.Item), code: f.Code?.trim() || `F-${f.Oid}` });
}
const nomenRows = [];
for (const b of bom) {
  const f = formulaItem.get(String(b.Formula));
  if (!f) continue;
  const pfId = artBySil.get(f.pfSilOid);
  const compId = artBySil.get(String(b.Item));
  if (!pfId || !compId) continue;
  nomenRows.push({
    sil_oid: b.Oid,
    code_formule: f.code,
    formule_sil_oid: String(b.Formula),
    article_id: pfId,
    composant_id: compId,
    quantite: num(b.Quantity) || 1,
  });
}
// Les formules sans ligne BOM (jamais décomposées) : ligne quantité 1 sur l'article lui-même
const withBom = new Set(nomenRows.map((n) => n.formule_sil_oid));
for (const [oid, f] of formulaItem) {
  if (!withBom.has(oid)) {
    const pfId = artBySil.get(f.pfSilOid);
    if (pfId) nomenRows.push({ sil_oid: `F-${oid}`, code_formule: f.code, formule_sil_oid: oid, article_id: pfId, composant_id: pfId, quantite: 1 });
  }
}
await upsert("erp_nomenclatures", nomenRows, "sil_oid", "lignes nomenclature");

console.log("\n✅ Import terminé — vérifiez /admin/articles, /admin/tiers, /admin/nomenclatures, /admin/lots.");
