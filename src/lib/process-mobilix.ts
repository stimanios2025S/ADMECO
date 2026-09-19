// ── Process MOBILIX — Chaise G21 & Chaise CANADA ──
// Source : schémas de production officiels (du matériau brut au produit fini).
// 12 postes, étape 5 COUTURE = 8 sous-opérations A→H scannées séparément (QR fin).
// 19 QR par chaise. Différences G21 / CANADA notées par étape.

export type EtapeDef = {
  ordre: number;
  code: string;
  nom: string;
  icone: string;
  description: string;
  consigne: string;
};

export type ModeleMobilix = "G21" | "CANADA";

export const MODELES_MOBILIX: Array<{
  code: ModeleMobilix;
  nom: string;
  detail: string;
  inserts: string;
  etape10: string;
}> = [
  {
    code: "G21",
    nom: "Chaise G21 — Simple, robuste, élégante",
    detail: "8 inserts / chaise · Piètement G21 · Assemblage final",
    inserts: "4 dossier + 4 assise = 8",
    etape10: "Piètement G21",
  },
  {
    code: "CANADA",
    nom: "Chaise Canada — Qualité, confort, durabilité",
    detail: "12 inserts / chaise · Accoudoirs + partie métal",
    inserts: "4 dossier + 4 assise + 4 accoudoirs = 12",
    etape10: "Accoudoirs",
  },
];

// Ordres décimaux : la couture A→H s'insère entre 5 et 6 (5.1 … 5.8).
export const ETAPES_MOBILIX: EtapeDef[] = [
  { ordre: 1, code: "MBX-COUPE-SKAI", nom: "Coupe Skaï / Tissu", icone: "🧵", description: "Table de coupe 7 × 2 m — assise + dossier", consigne: "Assise : étalage 375×140, 7 tapis 53×130 (= 21 assises). Dossier : étalage 375×140, 7 tapis. + bandes soufflet dos 3×75 / 5,5–6×75 / 7×75." },
  { ordre: 2, code: "MBX-COUPE-EPONGE", nom: "Coupe Éponge", icone: "🧽", description: "Éponge 4 cm + 1,5 cm D20/22 — feuille 160×190", consigne: "Découpe en plaques 53×190. Rendement assise : 4 assises + 1 dos. Rendement dos : 7 dos." },
  { ordre: 3, code: "MBX-COUPE-FILTRE", nom: "Coupe Filtre (Polyband)", icone: "🌀", description: "Rouleau 1,60 m — étalage 225×160", consigne: "Rendement : 8 filtres assise + 8 filtres dossier." },
  { ordre: 4, code: "MBX-TRACAGE", nom: "Traçage", icone: "✏️", description: "Réalisé par les polyvalents — carreaux de guidage", consigne: "Assise : 2 lignes verticales + 2 horizontales. Dos : 1 ligne verticale + 2 horizontales." },
  { ordre: 5.1, code: "MBX-COUT-A", nom: "Couture A — Rembourrage", icone: "🪡", description: "Pièces soufflet dos", consigne: "Pièce 3 cm, pièce 5,5/6 cm. Repli 1 cm + couture droite." },
  { ordre: 5.2, code: "MBX-COUT-B", nom: "Couture B — Fermeture", icone: "🤐", description: "Assemblage fermeture", consigne: "3 cm à gauche, 5,5/6 cm à droite." },
  { ordre: 5.3, code: "MBX-COUT-C", nom: "Couture C — Assemblage soufflet dos", icone: "🧷", description: "Soufflet 7×75 cm", consigne: "Soufflet 7×75 cm. Ajout étiquette MOBILIX. Petite surpiqûre." },
  { ordre: 5.4, code: "MBX-COUT-D", nom: "Couture D — Brodage assise", icone: "🧶", description: "Skaï/tissu + éponge 1,5 cm + filtre", consigne: "Skaï/tissu + éponge 1,5 cm + filtre. Couture sur lignes tracées." },
  { ordre: 5.5, code: "MBX-COUT-E", nom: "Couture E — Brodage dos", icone: "🧶", description: "Skaï/tissu + éponge 1,5 cm + filtre", consigne: "Skaï/tissu + éponge 1,5 cm + filtre. Couture sur lignes tracées." },
  { ordre: 5.6, code: "MBX-COUT-F", nom: "Couture F — Assemblage assise", icone: "🪑", description: "Assise Brodage + soufflet 10×180", consigne: "Assise Brodage + soufflet 10×180 cm. Valeur couture : 0,5 mm." },
  { ordre: 5.7, code: "MBX-COUT-G", nom: "Couture G — Assemblage dos 1", icone: "🪑", description: "Dos Brodage + soufflet dos", consigne: "Dos Brodage + soufflet dos. Bordeuse : 0,8 mm." },
  { ordre: 5.8, code: "MBX-COUT-H", nom: "Couture H — Assemblage dos 2", icone: "🪑", description: "Ensemble dos 1 + dos arrière", consigne: "Ensemble dos 1 + dos arrière. Valeurs : soufflet dos 1,8 mm • rembourrage 1 cm • fermeture 0,5 mm." },
  { ordre: 6, code: "MBX-CONTROLE", nom: "Contrôle qualité", icone: "🔍", description: "Contrôle à chaque étape de couture", consigne: "Alignement, valeur de couture, régularité, position étiquette, absence de plis. Défauts → reprise." },
  { ordre: 7, code: "MBX-PREP-BOIS", nom: "Préparation bois", icone: "🪵", description: "Dossier MDF 11 mm · Assise multiplex 8 à 10 mm", consigne: "G21 : 1 plaque MDF + 1 multiplex → 17 kits (17 dossiers + 17 assises). Vérifier cotes." },
  { ordre: 8, code: "MBX-INSERTS", nom: "Inserts", icone: "🔩", description: "G21 : 8 inserts · CANADA : 12 inserts", consigne: "G21 : 4 dossier + 4 assise. CANADA : + 4 accoudoirs (= 12). Vérifier serrage." },
  { ordre: 9, code: "MBX-REMBOURRAGE", nom: "Rembourrage & Habillage", icone: "🛋️", description: "Agrafage éponge 4 cm + housse", consigne: "Assise : agrafer éponge 4 cm sur bois, habillage cousu, filtre comme cache. Dossier : éponge 4 cm sur MDF, housse, fermeture, ouverture inserts au fer à souder." },
  { ordre: 10, code: "MBX-PIET-ACC", nom: "Piètement G21 / Accoudoirs", icone: "🦵", description: "G21 : piètement · CANADA : accoudoirs + métal", consigne: "G21 : réception structure peinte, contrôle, bouchonnage, 8 embouts, 4 sabots, vis 6×15. CANADA : éponge chûtes 1 à 1,5 cm ou découpe 5×16, skaï chutes ou découpe 8×20, puis rembourrage accoudoirs." },
  { ordre: 11, code: "MBX-ASSEMBLAGE", nom: "Partie métal / Assemblage final", icone: "🔧", description: "G21 : montage assise + dossier · CANADA : réception métal", consigne: "G21 : montage assise + dossier, vissage, contrôle stabilité, nettoyage. CANADA : réception structure peinte, contrôle qualité, bouchonnage, 6 embouts ovales, 4 sabots, vis 6×15." },
  { ordre: 12, code: "MBX-EMBALLAGE", nom: "Emballage", icone: "📦", description: "4 chaises par carton", consigne: "4 chaises + 4 dossiers + 4 assises + 4 accoudoirs + 4 sachets de 12 vis (48 vis) par carton. Protection carton." },
];

// ═══════════════════════════════════════════════════════════
// MOBILIX EN DEUX ATELIERS
//
// L'exploitant a confirmé que MOBILIX tient DEUX ateliers :
//   M1 (id 3) — Découpe bois
//   M2 (id 5) — Tapissage
//
// Les 12 postes ci-dessus décrivent le travail ; ils ne disent pas
// QUI le fait. Les deux listes ci-dessous répartissent ces postes
// par atelier, en conservant la consigne d'origine à l'identique —
// on ne réécrit pas le savoir-faire de l'atelier.
//
// ⚠️ Elles S'ENTRELACENT en production réelle : on coupe le tissu,
//    on prépare le bois, on pique, on rembourre, on assemble le
//    piètement, on emballe. C'est pourquoi le parcours complet est
//    décrit par src/lib/route-production.ts avec des `sequence`
//    globaux, et non par la seule numérotation locale ci-dessous.
// ═══════════════════════════════════════════════════════════

/**
 * M1 (atelier 3) — DÉCOUPE BOIS.
 * Bois, inserts, piètement/accoudoirs, assemblage final.
 * Renumérotées 1→4 : ce sont les étapes de CET atelier, et
 * l'ouvrier lit « étape 1 » sur son portail, pas « étape 7 ».
 */
export const ETAPES_M1_BOIS: EtapeDef[] = [
  { ordre: 1, code: "MBX-PREP-BOIS", nom: "Préparation bois", icone: "🪵", description: "Dossier MDF 11 mm · Assise multiplex 8 à 10 mm", consigne: "G21 : 1 plaque MDF + 1 multiplex → 17 kits (17 dossiers + 17 assises). Vérifier cotes." },
  { ordre: 2, code: "MBX-INSERTS", nom: "Inserts", icone: "🔩", description: "G21 : 8 inserts · CANADA : 12 inserts", consigne: "G21 : 4 dossier + 4 assise. CANADA : + 4 accoudoirs (= 12). Vérifier serrage." },
  { ordre: 3, code: "MBX-PIET-ACC", nom: "Piètement G21 / Accoudoirs", icone: "🦵", description: "G21 : piètement · CANADA : accoudoirs + métal", consigne: "G21 : réception structure peinte, contrôle, bouchonnage, 8 embouts, 4 sabots, vis 6×15. CANADA : éponge chûtes 1 à 1,5 cm ou découpe 5×16, skaï chutes ou découpe 8×20, puis rembourrage accoudoirs." },
  { ordre: 4, code: "MBX-ASSEMBLAGE", nom: "Partie métal / Assemblage final", icone: "🔧", description: "G21 : montage assise + dossier · CANADA : réception métal", consigne: "G21 : montage assise + dossier, vissage, contrôle stabilité, nettoyage. CANADA : réception structure peinte, contrôle qualité, bouchonnage, 6 embouts ovales, 4 sabots, vis 6×15." },
];

/**
 * M2 (atelier 5) — TAPISSAGE.
 * Coupe, traçage, couture (A→H), contrôle, rembourrage, emballage.
 *
 * ⚠️ La numérotation locale conserve les ordres décimaux d'origine
 *    (5.1 → 5.8) pour que la couture reste lisible telle que les
 *    schémas de production la décrivent. Les ordres 1→4 sont la
 *    coupe, et tout ce qui suit 5 est le montage de la housse.
 */
export const ETAPES_M2_TAPISSAGE: EtapeDef[] = [
  { ordre: 1, code: "MBX-COUPE-SKAI", nom: "Coupe Skaï / Tissu", icone: "🧵", description: "Table de coupe 7 × 2 m — assise + dossier", consigne: "Assise : étalage 375×140, 7 tapis 53×130 (= 21 assises). Dossier : étalage 375×140, 7 tapis. + bandes soufflet dos 3×75 / 5,5–6×75 / 7×75." },
  { ordre: 2, code: "MBX-COUPE-EPONGE", nom: "Coupe Éponge", icone: "🧽", description: "Éponge 4 cm + 1,5 cm D20/22 — feuille 160×190", consigne: "Découpe en plaques 53×190. Rendement assise : 4 assises + 1 dos. Rendement dos : 7 dos." },
  { ordre: 3, code: "MBX-COUPE-FILTRE", nom: "Coupe Filtre (Polyband)", icone: "🌀", description: "Rouleau 1,60 m — étalage 225×160", consigne: "Rendement : 8 filtres assise + 8 filtres dossier." },
  { ordre: 4, code: "MBX-TRACAGE", nom: "Traçage", icone: "✏️", description: "Réalisé par les polyvalents — carreaux de guidage", consigne: "Assise : 2 lignes verticales + 2 horizontales. Dos : 1 ligne verticale + 2 horizontales." },
  { ordre: 5.1, code: "MBX-COUT-A", nom: "Couture A — Rembourrage", icone: "🪡", description: "Pièces soufflet dos", consigne: "Pièce 3 cm, pièce 5,5/6 cm. Repli 1 cm + couture droite." },
  { ordre: 5.2, code: "MBX-COUT-B", nom: "Couture B — Fermeture", icone: "🤐", description: "Assemblage fermeture", consigne: "3 cm à gauche, 5,5/6 cm à droite." },
  { ordre: 5.3, code: "MBX-COUT-C", nom: "Couture C — Assemblage soufflet dos", icone: "🧷", description: "Soufflet 7×75 cm", consigne: "Soufflet 7×75 cm. Ajout étiquette MOBILIX. Petite surpiqûre." },
  { ordre: 5.4, code: "MBX-COUT-D", nom: "Couture D — Brodage assise", icone: "🧶", description: "Skaï/tissu + éponge 1,5 cm + filtre", consigne: "Skaï/tissu + éponge 1,5 cm + filtre. Couture sur lignes tracées." },
  { ordre: 5.5, code: "MBX-COUT-E", nom: "Couture E — Brodage dos", icone: "🧶", description: "Skaï/tissu + éponge 1,5 cm + filtre", consigne: "Skaï/tissu + éponge 1,5 cm + filtre. Couture sur lignes tracées." },
  { ordre: 5.6, code: "MBX-COUT-F", nom: "Couture F — Assemblage assise", icone: "🪑", description: "Assise Brodage + soufflet 10×180", consigne: "Assise Brodage + soufflet 10×180 cm. Valeur couture : 0,5 mm." },
  { ordre: 5.7, code: "MBX-COUT-G", nom: "Couture G — Assemblage dos 1", icone: "🪑", description: "Dos Brodage + soufflet dos", consigne: "Dos Brodage + soufflet dos. Bordeuse : 0,8 mm." },
  { ordre: 5.8, code: "MBX-COUT-H", nom: "Couture H — Assemblage dos 2", icone: "🪑", description: "Ensemble dos 1 + dos arrière", consigne: "Ensemble dos 1 + dos arrière. Valeurs : soufflet dos 1,8 mm • rembourrage 1 cm • fermeture 0,5 mm." },
  { ordre: 6, code: "MBX-CONTROLE", nom: "Contrôle qualité", icone: "🔍", description: "Contrôle à chaque étape de couture", consigne: "Alignement, valeur de couture, régularité, position étiquette, absence de plis. Défauts → reprise." },
  { ordre: 9, code: "MBX-REMBOURRAGE", nom: "Rembourrage & Habillage", icone: "🛋️", description: "Agrafage éponge 4 cm + housse", consigne: "Assise : agrafer éponge 4 cm sur bois, habillage cousu, filtre comme cache. Dossier : éponge 4 cm sur MDF, housse, fermeture, ouverture inserts au fer à souder." },
  { ordre: 12, code: "MBX-EMBALLAGE", nom: "Emballage", icone: "📦", description: "4 chaises par carton", consigne: "4 chaises + 4 dossiers + 4 assises + 4 accoudoirs + 4 sachets de 12 vis (48 vis) par carton. Protection carton." },
];

export const etapesMobilix = (): EtapeDef[] => ETAPES_MOBILIX;

export const etapeMobilixNom = (ordre: number): string =>
  ETAPES_MOBILIX.find((e) => e.ordre === ordre)?.nom ?? `Étape ${ordre}`;

// Affichage : 5.1→"5A", 5.2→"5B" … 5.8→"5H" ; entiers inchangés.
export const ordreMobilixCourt = (ordre: number): string => {
  if (ordre > 5 && ordre < 6) {
    const idx = Math.round((ordre - 5) * 10) - 1;
    return `5${"ABCDEFGH"[idx] ?? idx + 1}`;
  }
  return String(ordre);
};
