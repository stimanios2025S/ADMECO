// ── Façade « Gamme ECO » de l'Atelier 1 ──
// Cette gamme n'est plus définie ici : la source unique est
// `process-admedco-a1.ts`. Ce fichier ne fait que réexposer la même gamme
// sous les noms historiques (ETAPES_ECO / ECO_ETAPE_FINALE) et fournir les
// helpers de QR.
//
// ⚠️ NE PAS redéfinir d'étapes ici. Deux définitions concurrentes de la
//    gamme A1 ont déjà produit deux jeux d'étapes contradictoires sur le
//    même atelier ; c'est précisément ce que cette façade supprime.

import {
  ETAPES_A1_DETAIL,
  A1_TRANSFERT_FINAL,
  type EtapeDef,
} from "./process-admedco-a1";

export type EtapeEco = EtapeDef;

// L'encodage QR, l'objectif du matin et les compteurs du portail raisonnent
// sur « 6 étapes de production + 1 étape de sortie ».
const NB_PRODUCTION = ETAPES_A1_DETAIL.length - 1;

/** Les 6 étapes de production de l'Atelier 1 (ordres 1 → 6). */
export const ETAPES_ECO: EtapeEco[] = ETAPES_A1_DETAIL.slice(0, NB_PRODUCTION);

/**
 * 7e et dernière étape : la SORTIE de l'Atelier 1.
 *
 * Ce n'est plus une entrée en stock produit fini : depuis la création de
 * l'Atelier 3, les pièces de l'Atelier 1 partent au poudrage. Le nom
 * historique `ECO_STOCK_FINAL` désignait l'inverse et a été corrigé.
 */
export const ECO_ETAPE_FINALE: EtapeEco = A1_TRANSFERT_FINAL;

/** Gamme complète de l'Atelier 1 : 7 étapes. */
export const ETAPES_A1_GAMME: EtapeEco[] = ETAPES_A1_DETAIL;

// ── QR d'étape avec objectif du matin ──
// Format scanné par l'ouvrier : MES:STEP:<orderNumber>:<stepOrder>:<hash>
// L'objectif (combien produire ce matin) est lu depuis la base (target_qty),
// jamais encodé dans le QR — le QR reste stable même si l'admin change l'objectif.
export const ecoQrPayload = (orderNumber: string, stepOrder: number, hash: string) =>
  `MES:STEP:${orderNumber}:${stepOrder}:${hash}`;

// Libellé court affiché sous le QR : "Étape 3/7 · Perçage & usinage"
export const ecoQrLabel = (stepOrder: number): string => {
  const e = ETAPES_A1_GAMME.find((x) => x.ordre === stepOrder);
  return e ? `Étape ${e.ordre}/${ETAPES_A1_GAMME.length} · ${e.nom}` : `Étape ${stepOrder}`;
};
