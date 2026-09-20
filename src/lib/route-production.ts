// ═══════════════════════════════════════════════════════════
// ROUTE DE PRODUCTION — l'ordre GLOBAL des étapes d'un produit
//
// ── Pourquoi ce fichier existe ──
//
// Une pièce traverse PLUSIEURS ateliers, et chaque atelier
// numérote ses étapes à partir de 1. Une pièce peut donc avoir
// une « étape 3 » à l'Atelier 1, une autre à l'Atelier 3, et une
// troisième à l'Atelier 2.
//
// `ordre` (le champ des gammes) est LOCAL à l'atelier : c'est ce
// que l'ouvrier lit sur son portail. Il ne peut pas ordonner le
// parcours complet.
//
// `sequence` est GLOBAL : c'est lui qui dit ce qui vient avant
// quoi, tous ateliers confondus. C'est cette valeur qui est
// écrite dans work_order_steps.sequence, et c'est elle qui lève
// la contrainte d'unicité (item_id, sequence) posée par 0017.
//
//   A1 (7 étapes)          séquences  10 → 70
//   A3 phase 1 (5 étapes)  séquences  80 → 120
//   A2 (6 étapes)          séquences 130 → 180
//   A3 phase 2 (2 étapes)  séquences 190 → 200
//
// Les pas de 10 laissent la place d'insérer une étape sans
// renuméroter tout le reste.
//
// ── Le cas MOBILIX, qui justifie à lui seul ce mécanisme ──
//
// MOBILIX coupe le tissu (M2), prépare le bois (M1), pique (M2),
// rembourre (M2), assemble le piètement (M1), puis emballe (M2).
// Les deux ateliers S'ENTRELACENT. Aucune numérotation par
// atelier ne peut exprimer ça — d'où la route explicite ci-dessous.
// ═══════════════════════════════════════════════════════════

import type { AtelierId, DepotCode } from "./ateliers";
import type { EtapeDef } from "./etapes";
import { ETAPES_A1, ETAPES_A2, ETAPES_A3 } from "./etapes";
import { ETAPES_M1_BOIS, ETAPES_M2_TAPISSAGE } from "./process-mobilix";

/** Une étape replacée dans le parcours complet. */
export type EtapeRoute = EtapeDef & {
  /** Atelier qui exécute l'étape. */
  atelier: AtelierId;
  /** Ordre GLOBAL dans le parcours — écrit dans work_order_steps.sequence. */
  sequence: number;
  /** `ordre` local à l'atelier, tel que l'ouvrier le lit sur son portail. */
  ordreAtelier: number;
  /** Dépôt alimenté par la quantité OK, ou `null` si l'étape n'alimente rien. */
  depotSortie: DepotCode | null;
};

/** Un segment = une gamme d'atelier, à sa place dans le parcours. */
export type SegmentRoute = {
  atelier: AtelierId;
  etapes: EtapeDef[];
};

const PAS_SEQUENCE = 10;

/**
 * Assemble des segments d'ateliers en un parcours séquentiel unique.
 * Les `sequence` sont attribués dans l'ordre des segments, par pas de 10.
 */
export const construireRoute = (segments: readonly SegmentRoute[]): EtapeRoute[] => {
  const out: EtapeRoute[] = [];
  let sequence = 0;
  for (const seg of segments) {
    for (const e of seg.etapes) {
      sequence += PAS_SEQUENCE;
      out.push({
        ...e,
        atelier: seg.atelier,
        sequence,
        ordreAtelier: e.ordre,
        depotSortie: depotSortieEtape({ code: e.code, nom: e.nom }),
      });
    }
  }
  return out;
};

// ── Dépôt alimenté par chaque étape ──
// Même logique que `depotEntreeEtape` (etapes.ts), mais typée sur
// DepotCode et étendue aux étapes MOBILIX désormais câblées.
//
// ⚠️ Ne JAMAIS tester le seul numéro d'ordre. L'étape 7 de
//    l'Atelier 1 s'appelait autrefois « entrée en stock produit
//    fini » ; c'est aujourd'hui le TRANSFERT vers le poudrage. Un
//    test sur `ordre === 7` encaisserait des pièces non peintes en
//    produits finis.
export const depotSortieEtape = (etape: {
  code?: string | null;
  nom?: string | null;
}): DepotCode | null => {
  const code = etape.code ?? "";
  const nom = etape.nom ?? "";

  // Fin de chaîne ADMEDCO : le produit emballé entre en stock PF.
  if (code === "A3-EM-STK" || /stock produit fini/i.test(nom)) return "DEP-PF";

  // Sortie de l'Atelier 3, phase 1 : la pièce poudrée revient à son
  // atelier d'origine (A1 en semi-fini, A2 pour le montage).
  if (code === "A3-PO-SOR" || /sortie poudrage/i.test(nom)) return "DEP-A3";

  // Sortie de l'Atelier 1 : les pièces partent au POUDRAGE.
  if (code === "A1-TRF-A3" || /transfert vers atelier 3/i.test(nom)) return "DEP-A1";

  // Retour de l'Atelier 2 vers l'emballage.
  if (code === "A2-TRF-A3" || /retour atelier 3/i.test(nom)) return "DEP-A2";

  // Fin de chaîne MOBILIX.
  if (code === "MBX-EMBALLAGE" || /^emballage/i.test(nom)) return "DEP-M2";

  return null;
};

// ═══════════════════════════════════════════════════════════
// LES PARCOURS OFFICIELS
// ═══════════════════════════════════════════════════════════

/**
 * ADMEDCO — produit ASSEMBLÉ (bureau, chaise métal).
 *
 *   A1 tôle → A3 poudrage → A2 montage → A3 emballage → Stock PF
 *
 * C'est le parcours « poudrer avant de monter » : la pièce entre
 * DEUX FOIS à l'Atelier 3. Les deux passages sont ici deux
 * segments distincts, donc deux séquences distinctes — ce que
 * l'ancienne contrainte (item_id, step_order) interdisait.
 */
export const ROUTE_ADMEDCO_ASSEMBLE: EtapeRoute[] = construireRoute([
  { atelier: 1, etapes: ETAPES_A1 },
  { atelier: 4, etapes: ETAPES_A3.filter((e) => e.phase === "Poudrage (phase 1)") },
  { atelier: 2, etapes: ETAPES_A2 },
  { atelier: 4, etapes: ETAPES_A3.filter((e) => e.phase === "Emballage (phase 2)") },
]);

/**
 * ADMEDCO — pièce de TÔLE seule (pas de montage A2).
 *
 *   A1 tôle → A3 poudrage → Stock atelier 3
 *
 * S'arrête au semi-fini : la pièce poudrée attend son montage ou
 * sa vente. C'est le cas des pièces détachées et des structures
 * livrées brutes de montage.
 */
export const ROUTE_ADMEDCO_TOLE: EtapeRoute[] = construireRoute([
  { atelier: 1, etapes: ETAPES_A1 },
  { atelier: 4, etapes: ETAPES_A3.filter((e) => e.phase === "Poudrage (phase 1)") },
]);

/**
 * MOBILIX — chaise G21 / CANADA.
 *
 * Les deux ateliers s'ENTRELACENT : on coupe le tissu (M2), on
 * prépare le bois (M1), on pique (M2), on rembourre (M2), on
 * assemble le piètement (M1), on emballe (M2).
 *
 * C'est volontaire et c'est le parcours réel de l'atelier : le
 * bois sèche et s'apprête pendant que la couture avance. Un
 * parcours strictement séquentiel par atelier allongerait le
 * délai sans rien apporter.
 */
export const ROUTE_MOBILIX: EtapeRoute[] = construireRoute([
  { atelier: 5, etapes: ETAPES_M2_TAPISSAGE.filter((e) => e.ordre <= 4) }, // coupe + traçage
  { atelier: 3, etapes: ETAPES_M1_BOIS },                                   // bois, inserts, piètement, assemblage
  { atelier: 5, etapes: ETAPES_M2_TAPISSAGE.filter((e) => e.ordre >= 5) },  // couture, rembourrage, emballage
]);

// ── Sélection ──

export type ParcoursProduit = "ADMEDCO_ASSEMBLE" | "ADMEDCO_TOLE" | "MOBILIX";

export const ROUTES: Record<ParcoursProduit, EtapeRoute[]> = {
  ADMEDCO_ASSEMBLE: ROUTE_ADMEDCO_ASSEMBLE,
  ADMEDCO_TOLE: ROUTE_ADMEDCO_TOLE,
  MOBILIX: ROUTE_MOBILIX,
};

export const routePour = (parcours: ParcoursProduit): EtapeRoute[] => ROUTES[parcours] ?? [];

/** Étapes d'un parcours exécutées par un atelier donné, dans l'ordre global. */
export const routeAtelier = (parcours: ParcoursProduit, atelier: AtelierId): EtapeRoute[] =>
  routePour(parcours).filter((e) => e.atelier === atelier);

/** Nombre d'étapes par atelier pour un parcours — utile au pilotage. */
export const chargeParAtelier = (parcours: ParcoursProduit): Record<number, number> => {
  const out: Record<number, number> = {};
  for (const e of routePour(parcours)) out[e.atelier] = (out[e.atelier] ?? 0) + 1;
  return out;
};

// ═══════════════════════════════════════════════════════════
// QUEL PARCOURS POUR UN ARTICLE SILWANE ?
// ═══════════════════════════════════════════════════════════
// L'exploitant choisit toujours le parcours à l'écran. Ce qui suit
// n'est qu'une PROPOSITION, calculée sur les mots du catalogue :
//   · une chaise tapissée → MOBILIX (le mou d'abord)
//   · une pièce de tôle seule → ADMEDCO sans montage
//   · tout le reste → chaîne ADMEDCO complète
// La proposition se trompe parfois — c'est pour ça qu'elle est
// affichée et modifiable, jamais appliquée en silence.

export const PARCOURS_LABEL: Record<ParcoursProduit, string> = {
  ADMEDCO_ASSEMBLE: "ADMEDCO — tôle, poudrage, montage (A1 → A3 → A2 → A3)",
  ADMEDCO_TOLE: "ADMEDCO — pièce de tôle seule, semi-fini (A1 → A3)",
  MOBILIX: "MOBILIX — chaise tapissée (M2 → M1 → M2)",
};

export const PARCOURS_USINE: Record<ParcoursProduit, "ADMEDCO" | "MOBILIX"> = {
  ADMEDCO_ASSEMBLE: "ADMEDCO",
  ADMEDCO_TOLE: "ADMEDCO",
  MOBILIX: "MOBILIX",
};

const SANS_ACCENT = (s: string) =>
  s.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export const parcoursProbable = (a: {
  code?: string | null;
  designation?: string | null;
  famille?: string | null;
}): ParcoursProduit => {
  const texte = SANS_ACCENT(`${a.famille ?? ""} ${a.designation ?? ""}`);
  const code = (a.code ?? "").toUpperCase().trim();

  // MOBILIX : la chaise tapissée. Les deux modèles de l'atelier
  // (G21 et CANADA) sortent en famille CHAISE / TAPISSAGE.
  if (/(CHAISE|TAPISS|MOBILIX|REMBOURR)/.test(texte)) return "MOBILIX";
  if (/^(CHG|SCL|MBX|CHA)/.test(code)) return "MOBILIX";

  // Pièce de tôle, structure ou piètement vendue telle quelle : elle
  // s'arrête au poudrage, personne ne la monte.
  if (/(TOLE|STRUCTURE|PIETEMENT|SOCLE)/.test(texte)) return "ADMEDCO_TOLE";
  if (/^(TLE|TOL|STR|FRM|PIET|SOC|COL|PLA)/.test(code)) return "ADMEDCO_TOLE";

  return "ADMEDCO_ASSEMBLE";
};

// ── Le modèle, pour MOBILIX ──
// G21 et CANADA partagent les 12 postes : seuls les postes 10 et 11
// changent de contenu. Le modèle ne modifie donc PAS la route — il
// change ce que l'ouvrier lit à ces deux postes, et le nombre
// d'inserts à poser (8 contre 12).
export type ModeleMobilix = "G21" | "CANADA";

export const modeleProbable = (a: {
  code?: string | null;
  designation?: string | null;
}): ModeleMobilix => {
  const texte = SANS_ACCENT(`${a.code ?? ""} ${a.designation ?? ""}`);
  return /\bCANADA\b/.test(texte) ? "CANADA" : "G21";
};

export const MODELE_DETAIL: Record<ModeleMobilix, { inserts: string; poste10: string; poste11: string }> = {
  G21: { inserts: "8 inserts (4 dossier + 4 assise)", poste10: "Piètement G21", poste11: "Assemblage final (assise + dossier)" },
  CANADA: { inserts: "12 inserts (4 dossier + 4 assise + 4 accoudoirs)", poste10: "Accoudoirs", poste11: "Partie métal (réception structure)" },
};

/**
 * La route telle qu'elle doit être AFFICHÉE pour un modèle donné.
 * Même structure, mêmes `sequence` : seuls les libellés des postes
 * 10 et 11 de MOBILIX changent. On ne réécrit jamais une `sequence`
 * ici — elle est écrite en base par le lancement de production.
 */
export const routeAvecModele = (
  parcours: ParcoursProduit,
  modele: ModeleMobilix = "G21",
): EtapeRoute[] => {
  if (parcours !== "MOBILIX") return routePour(parcours);
  const d = MODELE_DETAIL[modele];
  return routePour(parcours).map((e) =>
    e.code === "MBX-PIET-ACC"
      ? { ...e, nom: d.poste10 }
      : e.code === "MBX-ASSEMBLAGE"
        ? { ...e, nom: d.poste11 }
        : e,
  );
};
