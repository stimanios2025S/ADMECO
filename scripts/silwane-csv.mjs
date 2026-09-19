// ═══════════════════════════════════════════════════════════
// LECTURE DES EXPORTS SILWANE — module partagé
//
// Tous les scripts d'analyse lisaient les mêmes CSV avec chacun sa
// copie du parseur. Une correction ici vaut pour tous.
//
// Silwane exporte en « ; » avec des champs parfois entre
// guillemets, parfois non, et un BOM UTF-8 en tête de fichier.
// Les nombres utilisent la virgule décimale, les booléens valent
// « t » / « f ».
//
// ⚠️ Lecture seule. Aucun script de ce dossier n'écrit dans Silwane.
// ═══════════════════════════════════════════════════════════
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export const DIR_DEFAUT = "E:/Massiexporte";

/**
 * Lit un CSV point-virgule et renvoie un tableau d'objets.
 * `requis = false` laisse passer un fichier absent (renvoie []).
 */
export function parseCsv(dir, file, requis = true) {
  const path = join(dir, file);
  if (!existsSync(path)) {
    if (requis) throw new Error(`Export absent : ${path}`);
    return [];
  }
  const raw = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
  const rows = [];
  let cur = [""];
  let q = false;
  const push = () => { rows.push(cur); cur = [""]; };

  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (q) {
      if (c === '"') {
        if (raw[i + 1] === '"') { cur[cur.length - 1] += '"'; i++; }
        else q = false;
      } else cur[cur.length - 1] += c;
    } else if (c === '"') q = true;
    else if (c === ";") cur.push("");
    else if (c === "\n") push();
    else if (c !== "\r") cur[cur.length - 1] += c;
  }
  if (cur.length > 1 || cur[0] !== "") push();

  const [head, ...data] = rows.filter((r) => r.length > 1 || r[0].trim() !== "");
  return data.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

/** Nombre à la française : virgule décimale, vide = 0. */
export const num = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/** Booléen Silwane : « t » = vrai. */
export const bool = (v) => String(v ?? "").toLowerCase() === "t";

/** Comparaison insensible à la casse, aux espaces et aux points. */
export const norm = (s) =>
  String(s ?? "").toUpperCase().replace(/[\s.\-_/]/g, "");

/**
 * Charge le référentiel complet et l'indexe.
 *
 * Les identifiants manipulés ici sont les `Oid` de Silwane (des
 * chaînes). Les fonctions pures du MES ne s'attachent qu'à
 * l'identité des clés : les Oid y jouent le rôle des UUID, ce qui
 * permet de rejouer la logique réelle sans base de données.
 */
export function chargerSilwane(dir = DIR_DEFAUT) {
  const items = parseCsv(dir, "COM_Item.csv");
  const formulas = parseCsv(dir, "COM_Formula.csv");
  const bom = parseCsv(dir, "COM_BOM.csv");
  const families = parseCsv(dir, "COM_ItemFamily.csv", false);

  const itemByOid = new Map(items.filter((a) => a.Oid).map((a) => [String(a.Oid), a]));
  const itemByCode = new Map(
    items.filter((a) => a.Code?.trim()).map((a) => [a.Code.trim().toUpperCase(), a])
  );
  const familleParOid = new Map(families.map((f) => [String(f.Oid), f.Label1?.trim() || ""]));

  const formuleParArticle = new Map();
  for (const f of formulas) if (f.Item) formuleParArticle.set(String(f.Item), f);

  const lignesParFormule = new Map();
  for (const b of bom) {
    const k = String(b.Formula);
    if (!lignesParFormule.has(k)) lignesParFormule.set(k, []);
    lignesParFormule.get(k).push(b);
  }

  // Un article est FABRIQUÉ s'il est déclaré tel, ou s'il apparaît
  // comme parent dans une nomenclature — même règle que l'agent
  // matière du MES (`chargerContexteAgent`).
  const formuleParOid = new Map(formulas.map((f) => [String(f.Oid), f]));
  const formulesUtilisees = new Set(bom.map((b) => String(b.Formula)).filter(Boolean));
  const articleParent = new Set(
    [...formulesUtilisees].map((oidF) => formuleParOid.get(oidF)?.Item).filter(Boolean).map(String)
  );

  const estFabrique = (a) => bool(a.IsBOM) || bool(a.IsSemiFinished) || articleParent.has(String(a.Oid));

  return {
    dir,
    items,
    formulas,
    bom,
    families,
    itemByOid,
    itemByCode,
    familleParOid,
    formuleParArticle,
    formuleParOid,
    lignesParFormule,
    articleParent,
    estFabrique,
  };
}

/** Retrouve un article par code exact, en ignorant casse et espaces autour. */
export const trouverParCode = (ref, code) =>
  ref.itemByCode.get(String(code ?? "").trim().toUpperCase()) ?? null;

/** Lignes de nomenclature d'un article, dans l'ordre de l'export. */
export const nomenclatureDe = (ref, articleOid) => {
  const f = ref.formuleParArticle.get(String(articleOid));
  if (!f) return { formule: null, lignes: [] };
  return { formule: f, lignes: ref.lignesParFormule.get(String(f.Oid)) ?? [] };
};
