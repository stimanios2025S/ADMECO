// ── Étapes officielles ADMEDCO + MOBILIX — 1 étape = 1 portail ──
// Atelier 1 (Bois & Découpe) : alimenté par DEP-MP, produit vers Stock A1.
// Atelier 2 (Assemblage & Finition) : réceptionne A1, alimenté par DEP-MP, produit vers Stock A2.
// Atelier MOBILIX M1 (Réception & Finition) : réceptionne ADMEDCO, alimenté par DEP-MP-MBX, produit vers Stock M1.

import type { AtelierId } from "./ateliers";

export type EtapeDef = {
  ordre: number;
  code: string;
  nom: string;
  icone: string;
  description: string;
  consigne: string;
};

export const ETAPES_A1: EtapeDef[] = [
  { ordre: 1, code: "A1-ARR", nom: "Arrivée matière première", icone: "📥", description: "Réception depuis DEP-MP centrale", consigne: "Vérifier quantité, qualité, bon de sortie MP." },
  { ordre: 2, code: "A1-COU", nom: "Découpe", icone: "🪚", description: "Découpe panneaux, débit bois", consigne: "Suivre le plan de coupe. Déclarer chuttes en perte." },
  { ordre: 3, code: "A1-USI", nom: "Usinage", icone: "⚙️", description: "CNC, perçage, profilage", consigne: "Contrôler cotes avant de terminer." },
  { ordre: 4, code: "A1-PRE", nom: "Préparation", icone: "🧱", description: "Ponçage, préparation assemblage", consigne: "Pièces propres, triées, étiquetées." },
  { ordre: 5, code: "A1-CTL", nom: "Contrôle A1 + mise en stock", icone: "✅", description: "Contrôle puis entrée Stock Atelier 1", consigne: "Tout bon → Stock A1. Rebut isolé et déclaré." },
];

export const ETAPES_A2: EtapeDef[] = [
  { ordre: 1, code: "A2-REC", nom: "Réception Atelier 1", icone: "📦", description: "Réception bordereau A1 → A2", consigne: "Scanner le bordereau MNF-, vérifier quantités." },
  { ordre: 2, code: "A2-ASM", nom: "Assemblage", icone: "🔧", description: "Assemblage bois + métal", consigne: "Visser, boulonner selon gamme. Déclarer MP consommée." },
  { ordre: 3, code: "A2-SOU", nom: "Soudage", icone: "⚡", description: "Soudure MIG des structures", consigne: "Contrôler cordons avant de passer." },
  { ordre: 4, code: "A2-POU", nom: "Poudrage", icone: "🎨", description: "Thermolaquage, peinture poudre", consigne: "Pièces dégraissées, poudre DEP-MP déclarée." },
  { ordre: 5, code: "A2-MON", nom: "Montage & finition", icone: "🪑", description: "Montage final, quincaillerie", consigne: "Tester stabilité, serrer, nettoyer." },
  { ordre: 6, code: "A2-CTL", nom: "Contrôle final + stock", icone: "✅", description: "QC puis entrée Stock Atelier 2", consigne: "Conforme → Stock A2 → expédition." },
];

// ── Atelier MOBILIX M1 : process officiel 12 postes / 19 QR (G21 + CANADA) ──
// Source de vérité : src/lib/process-mobilix.ts (schémas de production officiels).
// La couture A→H (ordres 5.1→5.8) est scannée QR par QR.
import { ETAPES_MOBILIX } from "./process-mobilix";

export const ETAPES_M1: EtapeDef[] = ETAPES_MOBILIX;

export const etapesAtelierMobilix = (): EtapeDef[] => ETAPES_M1;

export const etapesAtelier = (atelier: AtelierId): EtapeDef[] =>
  atelier === 1 ? ETAPES_A1 : atelier === 2 ? ETAPES_A2 : ETAPES_M1;

export const etapeNom = (atelier: AtelierId, ordre: number): string =>
  etapesAtelier(atelier).find((e) => e.ordre === ordre)?.nom ?? `Étape ${ordre}`;
