// ═══════════════════════════════════════════════════════════
// L'AGENT MATIÈRE — éclatement de nomenclature et réservation
//
// ── Ce qu'il fait, dans l'ordre ──
//
//   1. Il prend la commande (un produit fini, une quantité).
//   2. Il ouvre la NOMENCLATURE de ce produit et la déroule
//      récursivement jusqu'aux matières premières.
//   3. Il applique le RENDEMENT MATIÈRE : « une seule tôle /
//      un seul tube, combien de pièces ça donne ».
//   4. Il compare au stock disponible et RÉSERVE — réserver
//      n'est pas retirer.
//   5. Il calcule ce qui manque sous le seuil bas et en fait une
//      DETTE DE PRODUCTION reportée, pas une production immédiate.
//
// ── Exemple de l'exploitant, tel qu'il est traité ──
//
//   Commande : 300 chaises
//   Nomenclature : 1 chaise = 4 pièces de tube
//   Rendement : 1 tube → 4 pièces
//   ⇒ 300 × 4 = 1 200 pièces ⇒ 1 200 / 4 = 300 tubes réservés
//
// ── Ce qu'il ne compte PAS comme matière ──
//
// La nomenclature Silwane porte AUSSI la gamme : les articles
// « MAIN D'OEUVRE … » (MD001 à MD005) NOMMENT les opérations —
// préparation, soudage, poudrage, emballage et montage, cache-jupe.
//
// Ce ne sont pas des matières : l'article existe, mais il n'a ni
// stock ni nomenclature, donc il ne peut jamais être « manquant ».
// Les compter comme du stock à réserver produisait un manque
// fantôme par opération et polluait la dette de production.
//
// Ils sortent donc du plan matière (`estMainOeuvre`) et ressortent
// comme OPÉRATIONS (`OperationNomenclature`), exploitables pour
// dériver la gamme.
//
// ── Ce que ce module N'EST PAS ──
//
// Il ne touche PAS à la base : toutes les données lui sont fournies
// en entrée. C'est volontaire — la logique reste vérifiable sans
// serveur, et l'appelant garde la maîtrise de la transaction.
//
// ⚠️ Il n'invente JAMAIS un rendement. Si `rendement_matiere` n'a
//    pas de ligne pour un couple (matière, produit), il applique
//    1 pour 1 ET le signale (`rendementRenseigne: false`). C'est
//    visible dans le rapport, jamais silencieux.
// ═══════════════════════════════════════════════════════════

import type { UsineCode } from "./ateliers";

// ── Entrées ────────────────────────────────────────────────

/** Une ligne de nomenclature : `quantite` composants par produit fini. */
export type LigneNomenclature = {
  /** Article fabriqué. */
  articleId: string;
  /** Composant consommé. */
  composantId: string;
  /** Quantité de composant par unité de produit. */
  quantite: number;
};

export type ArticleInfo = {
  id: string;
  code: string;
  designation: string;
  unite: string;
  /** true = article fabriqué (a une nomenclature) ; false = matière d'achat. */
  estFabrique: boolean;
};

/** Rendement : `unitesProduites` pièces par unité de matière. */
export type RendementMatiere = {
  articleId: string;
  produitId: string | null;
  usineCode: UsineCode;
  unitesProduites: number;
};

/** État d'un stock, tel que lu depuis `stock_items` + réservations. */
export type StockDisponible = {
  stockItemId: string;
  articleId: string;
  depotCode: string;
  quantite: number;
  /** Déjà réservé par d'autres commandes en cours. */
  reserve: number;
  minQty: number | null;
  maxQty: number | null;
};

export type ContexteAgent = {
  usineCode: UsineCode;
  articles: ReadonlyMap<string, ArticleInfo>;
  nomenclature: readonly LigneNomenclature[];
  rendements: readonly RendementMatiere[];
  stocks: readonly StockDisponible[];
  /** Profondeur maximale de déroulement — garde-fou anti-boucle. */
  profondeurMax?: number;
};

// ── Sorties ────────────────────────────────────────────────

export type BesoinMatiere = {
  articleId: string;
  code: string;
  designation: string;
  unite: string;
  /** Besoin théorique issu de la seule nomenclature. */
  quantiteBrute: number;
  /** Besoin réel après application du rendement (en unités de matière). */
  quantiteNette: number;
  rendementApplique: number;
  /** false = aucun rendement en base, on a supposé 1 pour 1. */
  rendementRenseigne: boolean;
  /** Profondeur dans la nomenclature (1 = composant direct). */
  niveau: number;
  /** Chaîne d'appel, pour expliquer le calcul à l'écran. */
  chemin: string[];
};

export type LigneReservation = {
  articleId: string;
  stockItemId: string;
  depotCode: string;
  quantite: number;
};

/**
 * Une opération de MAIN D'ŒUVRE déclarée dans la nomenclature.
 *
 * L'article existe côté Silwane, mais il ne porte ni stock ni
 * nomenclature : c'est un NOM D'OPÉRATION. Il ne se réserve pas, ne
 * se consomme pas, ne se met pas en dette. Il décrit la gamme.
 */
export type OperationNomenclature = {
  articleId: string;
  code: string;
  designation: string;
  /**
   * Quantité cumulée sur la branche où l'opération a été rencontrée EN
   * PREMIER — donc pour la totalité de `quantiteProduit`, pas pour une
   * unité : une nomenclature multi-niveaux multiplie en descendant.
   *
   * Une même opération déclarée par deux parents ne donne qu'UNE
   * entrée, la première rencontrée. Additionner des quantités
   * relatives à des parents différents n'aurait pas de sens ; ce qui
   * compte ici, c'est l'enchaînement des opérations, pas leur somme.
   */
  quantite: number;
  /** Code du produit ou semi-fini qui déclare cette opération. */
  parentCode: string;
  /** 1 = déclarée directement par le produit fini. */
  niveau: number;
};

export type PlanMatiere = {
  besoins: BesoinMatiere[];
  reservations: LigneReservation[];
  /** Articles dont le stock disponible ne couvre pas le besoin. */
  manquants: Array<{ articleId: string; code: string; manque: number; unite: string }>;
  /** true si au moins un rendement était absent — le plan est approximatif. */
  rendementsIncomplets: boolean;
  /**
   * Opérations de main-d'œuvre lues dans la nomenclature — hors
   * matière, donc hors stock et hors dette. C'est la gamme telle que
   * Silwane l'écrit, à comparer à celle de `process-admedco-a1.ts`.
   */
  operations: OperationNomenclature[];
};

/**
 * Ce que produit la SEULE allocation sur stock. Le plan matière
 * complet y ajoute les opérations de main-d'œuvre : les deux
 * ensembles sortent du même parcours de nomenclature, mais restent
 * séparés — l'un se réserve sur stock, l'autre décrit la gamme.
 */
export type AllocationStock = Omit<PlanMatiere, "operations">;

// ═══════════════════════════════════════════════════════════
// 0. MAIN D'ŒUVRE — distinguer une opération d'une matière
// ═══════════════════════════════════════════════════════════

/**
 * Clé de comparaison d'un libellé : majuscules, accents et
 * ponctuation retirés.
 *
 * Silwane écrit « MAIN D'OEUVRE POUDRAGE » avec une apostrophe
 * droite, « MAIN D’OEUVRE » avec une typographique, et parfois une
 * espace finale. Tout cela doit se ramener à la même clé — c'est
 * pourquoi on ne compare pas les libellés caractère par caractère.
 */
const cleLibelle = (s: string): string =>
  String(s ?? "")
    .toUpperCase()
    // NFD sépare « É » en « E » + marque combinante. La marque n'est
    // pas dans [A-Z0-9] et tombe donc avec le reste : inutile de la
    // lister séparément.
    .normalize("NFD")
    // En revanche NFD ne décompose PAS la ligature Œ : sans cette
    // ligne, « MAIN D'ŒUVRE » deviendrait « MAINDUVRE » et
    // échapperait à la détection. Bug silencieux, d'où l'explicite.
    .replace(/Œ/g, "OE")
    .replace(/[^A-Z0-9]/g, "");

const CODE_MAIN_OEUVRE = /^MD\d+$/;
const LIBELLE_MAIN_OEUVRE = "MAINDOEUVRE";

/**
 * true si l'article est une OPÉRATION de main-d'œuvre, pas une
 * matière.
 *
 * Deux signaux, dans cet ordre : le CODE (`MD001`…`MD005`), puis le
 * LIBELLÉ (« MAIN D'OEUVRE … »). Le libellé rattrape un article dont
 * le code aurait été ressaisi ; le code rattrape un libellé renommé.
 *
 * ⚠️ Aucune table de codes n'est figée ici : le référentiel Silwane
 *    en contient cinq aujourd'hui (MD001 à MD005), et un MD006
 *    ajouté demain sera reconnu sans toucher à ce fichier.
 */
export const estMainOeuvre = (art: ArticleInfo | undefined): boolean => {
  if (!art) return false;
  if (CODE_MAIN_OEUVRE.test(String(art.code ?? "").trim().toUpperCase())) return true;
  return cleLibelle(art.designation).includes(LIBELLE_MAIN_OEUVRE);
};

// ═══════════════════════════════════════════════════════════
// 1. ÉCLATEMENT DE LA NOMENCLATURE
// ═══════════════════════════════════════════════════════════

type ResultatParcours = {
  /** Matières à réserver, cumulées par article. */
  feuilles: Map<string, BesoinMatiere>;
  /** Opérations de main-d'œuvre, une entrée par article. */
  operations: Map<string, OperationNomenclature>;
};

/**
 * Le parcours récursif commun, qui TRIE ce que contient la
 * nomenclature en deux ensembles : les matières (à réserver) et les
 * opérations de main-d'œuvre (à dérouler comme gamme).
 *
 * Les deux sorties viennent du MÊME passage. Les calculer par deux
 * traversées séparées serait deux occasions de diverger, et le
 * moindre écart entre le plan matière et la gamme serait invisible.
 *
 * La nomenclature Silwane est MULTI-NIVEAUX : un produit fabriqué
 * contient des semi-finis, qui contiennent eux-mêmes des matières.
 * Les quantités se MULTIPLIENT en descendant : 200 chaises × 4
 * pièces × … et non l'inverse.
 *
 * Une branche est une FEUILLE — donc une matière — dès qu'un article
 * n'a plus de nomenclature. C'est `estFabrique` qui le dit en
 * premier, la nomenclature sert de contrôle.
 */
const parcourirNomenclature = (
  produitId: string,
  quantiteProduit: number,
  ctx: ContexteAgent,
): ResultatParcours => {
  const profondeurMax = ctx.profondeurMax ?? 12;

  // Index composants par produit fini, pour ne pas reboucler dessus.
  const parProduit = new Map<string, LigneNomenclature[]>();
  for (const l of ctx.nomenclature) {
    const liste = parProduit.get(l.articleId);
    if (liste) liste.push(l);
    else parProduit.set(l.articleId, [l]);
  }

  const feuilles = new Map<string, BesoinMatiere>();
  const operations = new Map<string, OperationNomenclature>();

  type Tache = { articleId: string; quantite: number; niveau: number; chemin: string[] };
  const pile: Tache[] = [{ articleId: produitId, quantite: quantiteProduit, niveau: 0, chemin: [] }];

  // Garde-fou : une nomenclature peut contenir un cycle (erreur de
  // saisie Silwane). Sans cette limite, l'explosion ne rendrait
  // jamais la main.
  let iterations = 0;
  const maxIterations = 20_000;

  while (pile.length > 0) {
    if (++iterations > maxIterations) break;

    const t = pile.pop()!;
    const art = ctx.articles.get(t.articleId);
    const enfant = parProduit.get(t.articleId);

    const estFeuille = !art?.estFabrique || !enfant || enfant.length === 0;

    if (estFeuille || t.niveau >= profondeurMax) {
      // Cycle : l'article se contient lui-même, directement ou non.
      if (t.chemin.includes(t.articleId)) continue;

      const cle = t.articleId;
      const existant = feuilles.get(cle);
      const libelle = art?.code ?? t.articleId;
      if (existant) {
        existant.quantiteBrute += t.quantite;
        if (!existant.chemin.includes(libelle)) existant.chemin.push(libelle);
      } else {
        feuilles.set(cle, {
          articleId: t.articleId,
          code: art?.code ?? "—",
          designation: art?.designation ?? "(article inconnu)",
          unite: art?.unite ?? "pcs",
          quantiteBrute: t.quantite,
          quantiteNette: 0,
          rendementApplique: 1,
          rendementRenseigne: true,
          niveau: t.niveau,
          chemin: [...t.chemin, libelle],
        });
      }
      continue;
    }

    for (const l of enfant) {
      const composant = ctx.articles.get(l.composantId);
      const quantite = t.quantite * (Number(l.quantite) || 0);

      // ── Le tri se fait ICI, à l'entrée ──
      // Une opération de main-d'œuvre n'entre jamais dans la pile :
      // elle ne descendra pas jusqu'aux feuilles, donc elle ne
      // pourra jamais devenir un manque ni une dette.
      if (estMainOeuvre(composant)) {
        if (!operations.has(l.composantId)) {
          operations.set(l.composantId, {
            articleId: l.composantId,
            code: composant?.code ?? "—",
            designation: composant?.designation ?? "(article inconnu)",
            quantite,
            parentCode: art?.code ?? t.articleId,
            niveau: t.niveau + 1,
          });
        }
        continue;
      }

      pile.push({
        articleId: l.composantId,
        quantite,
        niveau: t.niveau + 1,
        chemin: [...t.chemin, art?.code ?? t.articleId],
      });
    }
  }

  return { feuilles, operations };
};

/**
 * Déroule la nomenclature d'un produit jusqu'aux MATIÈRES PREMIÈRES.
 *
 * Les opérations de main-d'œuvre sont EXCLUES de ce résultat : elles
 * ne sont pas de la matière. Pour la gamme, voir
 * `operationsDeNomenclature`.
 */
export const exploserNomenclature = (
  produitId: string,
  quantiteProduit: number,
  ctx: ContexteAgent,
): BesoinMatiere[] =>
  [...parcourirNomenclature(produitId, quantiteProduit, ctx).feuilles.values()].sort((a, b) =>
    a.code.localeCompare(b.code),
  );

/**
 * Les OPÉRATIONS de main-d'œuvre déclarées par la nomenclature d'un
 * produit — la gamme telle que Silwane l'écrit, en clair.
 *
 * Une opération rencontrée dans un semi-fini est remontée aussi :
 * c'est ce qui permet de reconstituer un enchaînement d'ateliers à
 * partir des seules données, sans table de gammes à maintenir.
 * `niveau` et `parentCode` disent OÙ l'opération est déclarée, ce
 * qui laisse l'appelant décider s'il agrège ou s'il détaille.
 */
export const operationsDeNomenclature = (
  produitId: string,
  quantiteProduit: number,
  ctx: ContexteAgent,
): OperationNomenclature[] =>
  [...parcourirNomenclature(produitId, quantiteProduit, ctx).operations.values()].sort((a, b) =>
    a.code.localeCompare(b.code),
  );

// ═══════════════════════════════════════════════════════════
// 2. APPLICATION DU RENDEMENT MATIÈRE
// ═══════════════════════════════════════════════════════════

/**
 * Convertit un besoin exprimé en PIÈCES en unités de MATIÈRE.
 *
 *   besoin net = besoin brut / unités produites par unité de matière
 *
 * Avec l'exemple de l'exploitant : 1 200 pièces / (4 pièces par
 * tube) = 300 tubes.
 *
 * Un rendement spécifique (matière + produit) prime sur un
 * rendement générique (matière seule, produitId null).
 */
export const appliquerRendement = (
  besoins: readonly BesoinMatiere[],
  produitId: string,
  ctx: ContexteAgent,
): BesoinMatiere[] => {
  const index = new Map<string, RendementMatiere>();
  for (const r of ctx.rendements) {
    if (r.usineCode !== ctx.usineCode) continue;
    index.set(`${r.articleId}|${r.produitId ?? "*"}`, r);
  }

  return besoins.map((b) => {
    const specifique = index.get(`${b.articleId}|${produitId}`);
    const generique = index.get(`${b.articleId}|*`);
    const r = specifique ?? generique;

    // Aucun rendement en base : on suppose 1 pour 1 et on le DIT.
    if (!r || !(Number(r.unitesProduites) > 0)) {
      return { ...b, quantiteNette: b.quantiteBrute, rendementApplique: 1, rendementRenseigne: false };
    }

    const facteur = Number(r.unitesProduites);
    return {
      ...b,
      quantiteNette: b.quantiteBrute / facteur,
      rendementApplique: facteur,
      rendementRenseigne: true,
    };
  });
};

// ═══════════════════════════════════════════════════════════
// 3. ALLOCATION SUR LE STOCK — on RÉSERVE, on ne retire pas
// ═══════════════════════════════════════════════════════════

/**
 * Répartit un besoin sur les stocks disponibles, dépôt par dépôt.
 *
 * ⚠️ On n'écrit AUCUN mouvement de consommation ici : on produit
 *    des lignes de RÉSERVATION. La matière sortira plus tard,
 *    quand l'ouvrier déclarera ce qu'il a réellement pris.
 *
 * L'ordre de prélèvement suit l'ordre des stocks fourni par
 * l'appelant (le dépôt MP central d'abord). Le disponible d'un
 * stock est `quantite - reserve` : ce qui est déjà réservé par une
 * autre commande n'est pas repris.
 */
export const allouerSurStock = (
  besoins: readonly BesoinMatiere[],
  ctx: ContexteAgent,
): AllocationStock => {
  const parArticle = new Map<string, StockDisponible[]>();
  for (const s of ctx.stocks) {
    const liste = parArticle.get(s.articleId);
    if (liste) liste.push(s);
    else parArticle.set(s.articleId, [s]);
  }

  const reservations: LigneReservation[] = [];
  const manquants: PlanMatiere["manquants"] = [];
  // Disponible restant, décrémenté au fil des besoins pour ne pas
  // réserver deux fois la même quantité.
  const restant = new Map<string, number>();
  for (const s of ctx.stocks) {
    restant.set(s.stockItemId, Math.max(0, Number(s.quantite) - Number(s.reserve)));
  }

  for (const b of besoins) {
    let aCouvrir = b.quantiteNette;
    if (!(aCouvrir > 0)) continue;

    for (const s of parArticle.get(b.articleId) ?? []) {
      if (aCouvrir <= 0) break;
      const dispo = restant.get(s.stockItemId) ?? 0;
      if (dispo <= 0) continue;

      const pris = Math.min(dispo, aCouvrir);
      restant.set(s.stockItemId, dispo - pris);
      aCouvrir -= pris;
      reservations.push({
        articleId: b.articleId,
        stockItemId: s.stockItemId,
        depotCode: s.depotCode,
        quantite: pris,
      });
    }

    if (aCouvrir > 0) {
      manquants.push({ articleId: b.articleId, code: b.code, manque: aCouvrir, unite: b.unite });
    }
  }

  return {
    besoins: [...besoins],
    reservations,
    manquants,
    rendementsIncomplets: besoins.some((b) => !b.rendementRenseigne),
  };
};

/**
 * Point d'entrée : produit + quantité → plan matière complet.
 *
 * `besoins` / `reservations` / `manquants` ne parlent que de
 * MATIÈRE. `operations` est l'autre moitié de la même lecture : la
 * main-d'œuvre lue dans la nomenclature, qui ne se réserve pas.
 */
export const planifierMatiere = (
  produitId: string,
  quantiteProduit: number,
  ctx: ContexteAgent,
): PlanMatiere => {
  const parcours = parcourirNomenclature(produitId, quantiteProduit, ctx);

  const bruts = [...parcours.feuilles.values()].sort((a, b) => a.code.localeCompare(b.code));
  const nets = appliquerRendement(bruts, produitId, ctx);

  return {
    ...allouerSurStock(nets, ctx),
    operations: [...parcours.operations.values()].sort((a, b) => a.code.localeCompare(b.code)),
  };
};

// ═══════════════════════════════════════════════════════════
// 4. LE SYSTÈME DE RÉCUPÉRATION — la dette de production
// ═══════════════════════════════════════════════════════════

export type ResultatRecuperation = {
  quantiteDemandee: number;
  /** Ce qu'on lance réellement en production (demande + dette reprise). */
  quantiteAProduire: number;
  /** Combien de dette ancienne est absorbée par cette commande. */
  detteAbsorbee: number;
  /** Nouveau manque créé, à reporter sur la commande suivante. */
  detteCreee: number;
  /** Ce qui restera en stock après la prise — informatif. */
  resteApresPrise: number;
};

/**
 * Applique la règle de récupération de l'exploitant.
 *
 *   Le stock ne doit pas descendre sous son PLANCHER. Si la prise
 *   l'y ferait descendre, le manque n'est PAS produit tout de
 *   suite : il devient une dette, absorbée par la commande
 *   suivante.
 *
 * Exemple donné par l'exploitant :
 *
 *   stock 500, plancher 200, commande 350
 *     → reste 150, donc manque 50 → dette 50, rien produit en plus
 *   commande suivante 400
 *     → 400 + 50 de dette = 450 lancés en production
 *
 * ⚠️ La dette absorbée ne peut pas dépasser ce qui est demandé :
 *    une commande de 10 ne peut pas absorber 50 de dette — sinon
 *    on produirait 5 fois ce que le client a commandé. Le solde
 *    reste ouvert pour la commande d'après.
 */
export const appliquerRecuperation = (params: {
  disponible: number;
  demande: number;
  minQty: number | null;
  detteOuverte: number;
}): ResultatRecuperation => {
  const min = Number(params.minQty ?? 0);
  const disponible = Number(params.disponible);
  const demande = Number(params.demande);
  const detteOuverte = Math.max(0, Number(params.detteOuverte));

  const resteApresPrise = disponible - demande;

  // Manque par rapport au plancher. Aucun plancher renseigné
  // ⇒ aucune dette : on ne présume pas d'un seuil.
  const detteCreee = min > 0 ? Math.max(0, min - resteApresPrise) : 0;

  // On ne peut absorber que ce qui ne dépasse pas la commande.
  const detteAbsorbee = Math.min(detteOuverte, Math.max(0, demande));

  return {
    quantiteDemandee: demande,
    quantiteAProduire: demande + detteAbsorbee,
    detteAbsorbee,
    detteCreee,
    resteApresPrise,
  };
};

/**
 * Ce qu'une production FAIT au stock et à la dette.
 * Utilisé quand l'atelier termine et met en stock.
 */
export const apresProduction = (params: {
  stockActuel: number;
  quantiteProduite: number;
  quantitePrelevee: number;
  maxQty: number | null;
}): { nouveauStock: number; depassementPlafond: number } => {
  const brut = Number(params.stockActuel) - Number(params.quantitePrelevee) + Number(params.quantiteProduite);
  const max = Number(params.maxQty ?? 0);
  return {
    nouveauStock: brut,
    // Un dépassement du plafond n'est pas une erreur : c'est un
    // signal. On le remonte pour que l'admin le voie, on ne
    // tronque pas la production.
    depassementPlafond: max > 0 ? Math.max(0, brut - max) : 0,
  };
};
