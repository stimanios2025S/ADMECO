// ── Étapes officielles ADMEDCO + MOBILIX — 1 étape = 1 portail ──
//
// ORDRE RETENU (décision exploitant) : ON POUDRE AVANT DE MONTER.
//
//   A1 (Tôle & Gros œuvre)  ─┐
//                            ├─→ A3 phase 1 : POUDrage ─┐
//   A2 (Bureau, mp métal)   ─┘                          │
//                                                       ↓
//                             A2 : MONTAGE sur pièces poudrées
//                                                       │
//                                                       ↓
//                             A3 phase 2 : EMBALLAGE → Stock produit fini
//
// Conséquence assumée : la pièce entre DEUX FOIS à l'Atelier 3 et, pour un
// même produit, le parcours revient sur A3. C'est le prix de « poudrer avant
// de monter » — 151 produits de la nomenclature Silwane contiennent à la fois
// du montage (MD004) et du garnissage mousse/skaï, ce qui interdit de poudrer
// après le montage (la mousse ne passe pas au four).
//
// A3 tient donc deux phases distinctes, portées par le champ `phase` :
//   Phase 1 « Poudrage »  : reçoit A1 et A2, ressort la pièce poudrée.
//   Phase 2 « Emballage » : reçoit A2 (monté), emballe, met en stock PF.
//
// Atelier MOBILIX M1 (Réception & Finition) : réceptionne ADMEDCO, alimenté par DEP-MP-MBX, produit vers Stock M1 — AUCUN lien avec A3.

import type { AtelierId } from "./ateliers";

export type EtapeDef = {
  ordre: number;
  code: string;
  nom: string;
  icone: string;
  description: string;
  consigne: string;
  /** Regroupement facultatif affiché par le portail (ex. « Poudrage », « Emballage »). */
  phase?: string;
};

// ── Atelier 1 (Tôle & Gros œuvre) : 5 opérations · 7 étapes (1 étape = 1 QR) ──
// Source de vérité : src/lib/process-admedco-a1.ts
// La gamme se termine par le TRANSFERT vers l'Atelier 3 (poudrage), pas par
// une entrée en stock produit fini.
import { ETAPES_A1_DETAIL, OPERATIONS_A1 } from "./process-admedco-a1";

export const ETAPES_A1: EtapeDef[] = ETAPES_A1_DETAIL.map((e) => ({
  ordre: e.ordre,
  code: e.code,
  nom: e.nom,
  icone: e.icone,
  description: e.description,
  consigne: e.consigne,
  // Déjà portée par la source : « Production tôle » / « Transfert ».
  phase: e.phase,
}));

export const operationsA1 = () => OPERATIONS_A1;

export { OPERATIONS_A1, ETAPES_A1_DETAIL, operationA1DeEtape, operationA1Nom } from "./process-admedco-a1";

// ── Atelier 2 (Bureau) : MONTAGE sur pièces déjà poudrées ──
// A2 ne soude plus de métal nu en série : les structures métalliques qu'il
// monte lui arrivent POUDRIES de l'Atelier 3 (phase 1). Il assemble, monte
// les panneaux et la quincaillerie, contrôle, puis RENVOIE la pièce à
// l'Atelier 3 (phase 2) pour l'emballage et le stock produit fini.
//
// Corollaire : la première étape de A2 est une réception DEPUIS l'Atelier 3,
// pas depuis l'Atelier 1.
export const ETAPES_A2: EtapeDef[] = [
  { ordre: 1, code: "A2-REC-A3", nom: "Réception pièces poudrées", icone: "📦", description: "Réception des pièces poudrées venant de l'Atelier 3", consigne: "Scanner le bordereau A3 → A2. Vérifier teinte, aspect, quantités. Rayure ou manque → refus tracé." },
  { ordre: 2, code: "A2-ASM", nom: "Assemblage mécanique", icone: "🔧", description: "Assemblage des structures et piètements de bureau", consigne: "Visser et boulonner selon gamme. Ne jamais meuler ni percer une pièce poudrée sans reprise déclarée." },
  { ordre: 3, code: "A2-BOI", nom: "Montage panneaux & plateau", icone: "🪵", description: "Pose des plateaux, caissons et panneaux bois", consigne: "Sens du fil et chants alignés. Déclarer la panneaux consommés (DEP-MP)." },
  { ordre: 4, code: "A2-MON", nom: "Montage final & quincaillerie", icone: "🪑", description: "Montage final, garnissage et quincaillerie", consigne: "Tester stabilité et serrage. Mousse et skaï posés ici — c'est pourquoi le poudrage est fait AVANT." },
  { ordre: 5, code: "A2-CTL", nom: "Contrôle final A2", icone: "🔍", description: "QC avant retour à l'Atelier 3", consigne: "Cotes, aspect et stabilité vérifiés. Rebut isolé et déclaré." },
  { ordre: 6, code: "A2-TRF-A3", nom: "Retour Atelier 3 (emballage)", icone: "↩️", description: "Bordereau A2 → A3 pour emballage final", consigne: "Déclarer OK / perdu. Générer le bordereau retour vers l'Atelier 3." },
];

// ── Atelier 3 (Poudrage & Emballage) — le point de convergence ──
// A3 travaille POUR les deux ateliers de fabrication, en DEUX PASSES :
//
//   Phase 1 — Poudrage  : reçoit A1 (tôle, gros œuvre) et les pièces métal
//                         de A2, poudre, contrôle, renvoie la pièce poudrée
//                         à son atelier d'origine (A1 → semi-fini, A2 → montage).
//   Phase 2 — Emballage : reçoit le produit MONTÉ par A2, emballe, met en
//                         stock produit fini (DEP-PF).
//
//   A1 ─┐
//       ├─→ A3 phase 1 (poudrage) ─→ A2 (montage) ─→ A3 phase 2 (emballage) → Stock PF
//   A2 ─┘
//
// Le champ `phase` porte les deux passes ; le portail les regroupe.
export const PHASE_A3_POUDRAGE = "Poudrage (phase 1)";
export const PHASE_A3_EMBALLAGE = "Emballage (phase 2)";

export const ETAPES_A3: EtapeDef[] = [
  { ordre: 1, code: "A3-PO-REC", nom: "Réception pièces à poudrer", icone: "📥", phase: PHASE_A3_POUDRAGE, description: "Réception des pièces brutes venant de l'Atelier 1 et de l'Atelier 2", consigne: "Scanner le bordereau, vérifier l'origine (A1 ou A2), les quantités et l'absence de rouille." },
  { ordre: 2, code: "A3-PO-PRE", nom: "Préparation & dégraissage", icone: "🧴", phase: PHASE_A3_POUDRAGE, description: "Dégraissage, lavage et accroche avant thermolaquage", consigne: "Pièce sèche et dégraissée. Toute trace de gras fait rebuter la poudre." },
  { ordre: 3, code: "A3-PO-POU", nom: "Poudrage & cuisson", icone: "🎨", phase: PHASE_A3_POUDRAGE, description: "Thermolaquage — application de la poudre puis passage au four", consigne: "Déclarer la poudre consommée depuis DEP-MP. Respecter la teinte de la gamme et l'épaisseur du film." },
  { ordre: 4, code: "A3-PO-CTL", nom: "Contrôle après cuisson", icone: "🔍", phase: PHASE_A3_POUDRAGE, description: "Contrôle d'aspect, de teinte et d'adhérence", consigne: "Pas de coulure, pas de manque, teinte conforme. Rebut isolé et déclaré en perte." },
  { ordre: 5, code: "A3-PO-SOR", nom: "Sortie poudrage → atelier d'origine", icone: "↩️", phase: PHASE_A3_POUDRAGE, description: "Retour des pièces poudrées vers A1 (semi-fini) ou A2 (montage)", consigne: "Déclarer OK / perdu. Pièces protégées et étiquetées : le poudrage ne doit pas être rayé par la manutention." },
  { ordre: 6, code: "A3-EM-EMB", nom: "Emballage final", icone: "📦", phase: PHASE_A3_EMBALLAGE, description: "Emballage du produit monté par l'Atelier 2, prêt pour expédition", consigne: "Intercalaires et coins protégés. Étiqueter le lot avec le N° de commande." },
  { ordre: 7, code: "A3-EM-STK", nom: "Stock produit fini", icone: "✅", phase: PHASE_A3_EMBALLAGE, description: "Entrée au stock produit fini (DEP-PF)", consigne: "Déclarer OK / perdu. Quantité validée → Stock produit fini." },
];

// ── Atelier MOBILIX M1 : process officiel 12 postes / 19 QR (G21 + CANADA) ──
// Source de vérité : src/lib/process-mobilix.ts (schémas de production officiels).
// La couture A→H (ordres 5.1→5.8) est scannée QR par QR.
import { ETAPES_MOBILIX } from "./process-mobilix";

export const ETAPES_M1: EtapeDef[] = ETAPES_MOBILIX;

export const etapesAtelierMobilix = (): EtapeDef[] => ETAPES_M1;

// Chaque atelier a sa gamme, sans repli implicite : un `atelier` inconnu
// renvoyait silencieusement la gamme MOBILIX, ce qui affichait les 12 postes
// G21/Canada à un ouvrier ADMEDCO.
export const etapesAtelier = (atelier: AtelierId): EtapeDef[] =>
  atelier === 1 ? ETAPES_A1
  : atelier === 2 ? ETAPES_A2
  : atelier === 4 ? ETAPES_A3
  : atelier === 3 ? ETAPES_M1
  : [];

export const etapeNom = (atelier: AtelierId, ordre: number): string =>
  etapesAtelier(atelier).find((e) => e.ordre === ordre)?.nom ?? `Étape ${ordre}`;

// ── Destination d'une étape terminée ──
// Quand un ouvrier déclare une étape terminée, la quantité OK entre dans un
// dépôt. C'est CETTE fonction qui le dit, et rien d'autre.
//
// ⚠️ Ne JAMAIS réintroduire un test sur `step_order === 7`. L'étape 7 de
//    l'Atelier 1 était autrefois « entrée en stock produit fini » ; depuis la
//    création de l'Atelier 3 c'est le TRANSFERT vers le poudrage. Un test sur
//    le seul numéro d'ordre encaisserait des pièces non peintes en produits
//    finis — le bug corrigé ici.
//
// Renvoie `null` quand l'étape n'alimente aucun dépôt (poste de production
// intermédiaire) : c'est le cas normal, pas une erreur.
export const depotEntreeEtape = (etape: {
  code?: string | null;
  nom?: string | null;
  step_name?: string | null;
}): string | null => {
  const code = etape.code ?? "";
  const nom = etape.nom ?? etape.step_name ?? "";

  // Fin de chaîne : l'emballage de l'Atelier 3 met le produit fini en stock.
  if (code === "A3-EM-STK" || /stock produit fini/i.test(nom)) return "DEP-PF";

  // Sortie de l'Atelier 1 : les pièces partent au POUDRAGE, pas au stock PF.
  if (code === "A1-TRF-A3" || /transfert vers atelier 3/i.test(nom)) return "DEP-A3";

  // Les autres étapes de transfert (A2 → A3, A3 → atelier d'origine) ne sont
  // pas encore câblées : aucun bouton de lancement ne les écrit. On renvoie
  // null plutôt que de deviner un dépôt — un mauvais dépôt vaut moins qu'un
  // dépôt manquant, il est impossible à repérer après coup.
  return null;
};

/** Regroupe des étapes par phase, dans l'ordre d'apparition. Utile pour A3. */
export const grouperParPhase = (etapes: EtapeDef[]): Array<{ phase: string | null; etapes: EtapeDef[] }> => {
  const out: Array<{ phase: string | null; etapes: EtapeDef[] }> = [];
  for (const e of etapes) {
    const phase = e.phase ?? null;
    const dernier = out[out.length - 1];
    if (dernier && dernier.phase === phase) dernier.etapes.push(e);
    else out.push({ phase, etapes: [e] });
  }
  return out;
};
