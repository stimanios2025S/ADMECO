// ── Gamme ATELIER 1 — Tôle & Gros œuvre (ADMEDCO) ──
// SOURCE UNIQUE DE VÉRITÉ de la gamme A1 : les deux boutons de lancement
// admin (`lancerSuiviEco` et `lancerSuiviA1`) écrivent désormais les mêmes
// étapes. Auparavant ils écrivaient deux gammes différentes sur le MÊME
// atelier_id (7 étapes d'un côté, 19 de l'autre), d'où deux vérités
// contradictoires dans la file ouvrier.
//
// Contenu justifié par la nomenclature Silwane : les articles de main
// d'œuvre nomment les opérations et attestent, pour l'Atelier 1 :
//     MD001  MAIN D'OEUVRE PREPARATION  → débit, coupe
//     MD002  MAIN D'OEUVRE SOUDAGE      → soudage, assemblage
//     MD005  MAIN D'OEUVRE CACHE JUPE   → façonnage cache-jupe
// (liste mesurée par scripts/operations-silwane.mjs — 199 des 244 produits
//  portent leur gamme ÉCRITE dans leur nomenclature.)
//
// ⚠️ Le POUDrage a QUITTÉ cet atelier : il appartient à l'Atelier 3, qui
//    le fait pour l'Atelier 1 comme pour l'Atelier 2. L'Atelier 1 se
//    termine donc par un TRANSFERT vers l'Atelier 3, plus par une entrée
//    en stock produit fini.
//
// Flux : DEP-MP → A1 (7 étapes) → A3 (poudrage) → A2 (montage) → A3 (emballage) → Stock PF

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

/** Les 6 premières étapes de A1 produisent ; la 7e expédie vers l'Atelier 3. */
export const PHASE_A1_PRODUCTION = "Production tôle";
export const PHASE_A1_TRANSFERT = "Transfert"

export type OperationA1 = {
  code: string;
  nom: string;
  icone: string;
  description: string;
  consigneGlobale: string;
  etapes: EtapeDef[];
};

export const OPERATIONS_A1: OperationA1[] = [
  {
    code: "OP-REC",
    nom: "Réception & Préparation MP",
    icone: "📥",
    description: "Réception de la matière depuis DEP-MP centrale, contrôle et mise à disposition des postes.",
    consigneGlobale: "Aucune pièce ne part en débit sans contrôle matière validé. Tout écart → rebut déclaré.",
    etapes: [
      {
        ordre: 1,
        code: "A1-REC-MP",
        nom: "Réception matière",
        icone: "📥",
        description: "Réception tôles, tubes et profilés depuis DEP-MP",
        consigne: "Vérifier bon de sortie MP, quantité, épaisseur et dimensions. Déclarer la matière consommée par lot.",
      },
    ],
  },
  {
    code: "OP-DEB",
    nom: "Débit & Coupe",
    icone: "🪚",
    description: "Coupe et perçage de la tôle et des profilés aux cotes du plan.",
    consigneGlobale: "Suivre le plan de coupe à la lettre. Chutes réutilisables → stock chutes, sinon perte déclarée.",
    etapes: [
      {
        ordre: 2,
        code: "A1-DEB-COU",
        nom: "Coupe & débit",
        icone: "🪚",
        description: "Découpe tôle et profilés aux cotes",
        consigne: "Sécurité : gants et lunettes. Tolérance +2 mm avant finition. Ébavurer aussitôt.",
      },
      {
        ordre: 3,
        code: "A1-DEB-PER",
        nom: "Perçage & usinage",
        icone: "🔩",
        description: "Perçage des trous d'assemblage et de fixation",
        consigne: "Gabarit verrouillé. Contrôler 1 pièce sur 5. Toute pièce hors cote est isolée.",
      },
    ],
  },
  {
    code: "OP-SOU",
    nom: "Soudage & Assemblage",
    icone: "⚡",
    description: "Soudure MIG des structures métalliques et façonnage des caches-jupes.",
    consigneGlobale: "La pièce qui part à l'Atelier 3 est soudée complète, ébavurée et propre.",
    etapes: [
      {
        ordre: 4,
        code: "A1-SOU-ASS",
        nom: "Soudage & assemblage",
        icone: "⚡",
        description: "Soudure MIG des structures et piètements",
        consigne: "Contrôler les cordons avant de passer. Meuler les projections. Déclarer le fil à souder consommé.",
      },
      {
        ordre: 5,
        code: "A1-SOU-CJP",
        nom: "Façonnage cache-jupe",
        icone: "🪟",
        description: "Mise en forme et ajustage des caches-jupes",
        consigne: "Vérifier l'alignement et les jeux. Pièce qui ne plaque pas → reprise, pas de mastic.",
      },
    ],
  },
  {
    code: "OP-CTL",
    nom: "Contrôle A1",
    icone: "🔍",
    description: "Contrôle dimensionnel et aspect avant envoi au poudrage.",
    consigneGlobale: "Rien ne part à l'Atelier 3 sans contrôle validé et quantités déclarées.",
    etapes: [
      {
        ordre: 6,
        code: "A1-CTL-FIN",
        nom: "Contrôle dimensionnel",
        icone: "🔍",
        description: "Contrôle cotes, équerrage et qualité des cordons",
        consigne: "Pied à coulisse et gabarit. Déclarer produit réussi et produit perdu.",
      },
    ],
  },
  {
    code: "OP-TRF",
    nom: "Transfert vers Atelier 3",
    icone: "➡️",
    description: "Sortie vers l'Atelier 3, qui réalise le poudrage pour l'Atelier 1 et l'Atelier 2.",
    consigneGlobale: "Les pièces partent nues : le poudrage est fait à l'Atelier 3, pas ici.",
    etapes: [
      {
        ordre: 7,
        code: "A1-TRF-A3",
        nom: "Transfert vers Atelier 3",
        icone: "➡️",
        description: "Entrée Stock A1 puis bordereau vers l'Atelier 3 (poudrage)",
        consigne: "Déclarer OK / perdu. Générer le bordereau vers l'Atelier 3. Pièces protégées et étiquetées.",
      },
    ],
  },
];

// ── À plat : 7 étapes (ordre global 1→7), compatible portail existant ──
export const ETAPES_A1_DETAIL: Array<EtapeDef & { operationCode: string; operationNom: string }> =
  OPERATIONS_A1.flatMap((op) =>
    op.etapes.map((e) => ({
      ...e,
      // La phase est déduite de l'opération : tout ce qui n'est pas le
      // transfert vers l'Atelier 3 est de la production.
      phase: op.code === "OP-TRF" ? PHASE_A1_TRANSFERT : PHASE_A1_PRODUCTION,
      operationCode: op.code,
      operationNom: op.nom,
    }))
  );

// L'étape de sortie, à part : c'est elle qui envoie vers l'Atelier 3.
// Les 6 premières étapes sont la production, la 7e est le transfert.
export const A1_TRANSFERT_FINAL: EtapeDef = OPERATIONS_A1[OPERATIONS_A1.length - 1].etapes[0];

export const etapesOperationA1 = (codeOperation: string): EtapeDef[] =>
  OPERATIONS_A1.find((op) => op.code === codeOperation)?.etapes ?? [];

export const operationA1DeEtape = (ordre: number): OperationA1 | null =>
  OPERATIONS_A1.find((op) => op.etapes.some((e) => e.ordre === ordre)) ?? null;

export const operationA1Nom = (ordre: number): string =>
  operationA1DeEtape(ordre)?.nom ?? "Atelier 1";
