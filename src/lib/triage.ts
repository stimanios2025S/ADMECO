// ═══════════════════════════════════════════════════════════
// LE TRIAGE — une commande client, deux chaînes de production
//
// ── Le principe ──
//
// Un produit fini n'est presque jamais fabriqué par une seule
// usine. Une chaise, c'est du DUR (tube, métal — ADMEDCO) et du
// MOU (bois, mousse, skaï — MOBILIX). Le triage découpe donc la
// commande en autant de sous-commandes qu'il y a d'usines
// concernées.
//
// ── Ce que le triage NE fait pas ──
//
// Il ne MÉLANGE jamais les deux usines. Chaque sous-commande est
// un `work_orders` distinct, avec son `usine_code`, sa gamme et
// ses documents. Elles ne sont reliées que par
// `commande_client_id` — un lien de traçabilité, pas une fusion.
//
// ⚠️ La classification d'un article par usine est FOURNIE ou
//    DÉDUITE. La déduction repose sur des mots-clés de
//    désignation : c'est un point de départ honnête, pas une
//    vérité. Dès que l'exploitant donnera la vraie répartition,
//    `classerArticle` la remplacera sans toucher au reste.
// ═══════════════════════════════════════════════════════════

import type { UsineCode } from "./ateliers";
import type { ParcoursProduit } from "./route-production";
import type { ArticleInfo, ContexteAgent, LigneNomenclature } from "./agent-matiere";

export type RepartitionUsine = {
  usineCode: UsineCode;
  parcours: ParcoursProduit;
  /** Quantité de produits finis concernés — identique pour les deux parts. */
  quantite: number;
  /** Composants qui justifient cette part, pour l'expliquer à l'écran. */
  composants: Array<{ articleId: string; code: string; designation: string }>;
};

export type ResultatTriage = {
  repartitions: RepartitionUsine[];
  /** Composants qu'on n'a su rattacher à aucune usine. */
  nonClassee: Array<{ articleId: string; code: string; designation: string }>;
};

// ── Déduction par mots-clés ──
// Sert uniquement tant que la répartition réelle n'est pas fournie.
// Les motifs sont volontairement larges : mieux vaut rattacher un
// article au mauvais endroit — c'est visible et corrigeable — que
// de le perdre silencieusement.
const MOTS_MOBILIX = [
  "skai", "skaï", "tissu", "mousse", "eponge", "éponge", "polyband",
  "filtre", "bois", "mdf", "multiplex", "contreplaque", "contreplaqué",
  "couture", "fil ", "housse", "rembourr", "tapiss", "carton",
];
const MOTS_ADMEDCO = [
  "tole", "tôle", "tube", "profil", "acier", "fer ", "ferr", "inox",
  "poudre", "peinture", "galva", "vis ", "boulon", "ecrou", "écrou",
  "rondelle", "patin", "structure", "pietement", "piètement",
];

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ");

const deduireUsine = (a: ArticleInfo | undefined): UsineCode | null => {
  if (!a) return null;
  const texte = norm(`${a.code} ${a.designation}`);
  const mobilix = MOTS_MOBILIX.reduce((n, m) => n + (texte.includes(norm(m)) ? 1 : 0), 0);
  const admedco = MOTS_ADMEDCO.reduce((n, m) => n + (texte.includes(norm(m)) ? 1 : 0), 0);
  if (mobilix === 0 && admedco === 0) return null;
  return mobilix > admedco ? "MOBILIX" : "ADMEDCO";
};

/** Parcours à appliquer à une part, selon l'usine et la présence d'un assemblage. */
const parcoursPour = (usine: UsineCode, aAssemblage: boolean): ParcoursProduit => {
  if (usine === "MOBILIX") return "MOBILIX";
  return aAssemblage ? "ADMEDCO_ASSEMBLE" : "ADMEDCO_TOLE";
};

// ═══════════════════════════════════════════════════════════
// LE TRIAGE
// ═══════════════════════════════════════════════════════════

/**
 * Découpe une ligne de commande en sous-commandes par usine.
 *
 * On regarde les composants DIRECTS du produit : ce sont eux qui
 * disent quelles chaînes sont concernées. Descendre toute la
 * nomenclature serait inutile ici — une vis dans un semi-fini
 * MOBILIX n'en fait pas pour autant une commande ADMEDCO.
 *
 * @param classerArticle  répartition réelle, si l'exploitant l'a
 *                        fournie. Sinon la déduction par mots-clés.
 */
export const trierCommande = (
  produitId: string,
  quantite: number,
  ctx: ContexteAgent,
  classerArticle?: (articleId: string) => UsineCode | null,
): ResultatTriage => {
  const composants = ctx.nomenclature.filter((l: LigneNomenclature) => l.articleId === produitId);

  const parUsine = new Map<UsineCode, RepartitionUsine["composants"]>();
  const nonClassee: ResultatTriage["nonClassee"] = [];

  for (const l of composants) {
    const art = ctx.articles.get(l.composantId);
    const usine = classerArticle?.(l.composantId) ?? deduireUsine(art);
    const entree = {
      articleId: l.composantId,
      code: art?.code ?? "—",
      designation: art?.designation ?? "(inconnu)",
    };
    if (!usine) {
      nonClassee.push(entree);
      continue;
    }
    const liste = parUsine.get(usine);
    if (liste) liste.push(entree);
    else parUsine.set(usine, [entree]);
  }

  // Aucune nomenclature exploitable : on ne peut pas trier, mais on
  // ne bloque pas la commande. Le produit part sur la chaîne
  // ADMEDCO complète — le cas le plus courant — et on le signale
  // par une liste de composants vide.
  if (parUsine.size === 0) {
    parUsine.set("ADMEDCO", []);
  }

  const aAssemblage = (parUsine.get("ADMEDCO")?.length ?? 0) > 0;

  const repartitions: RepartitionUsine[] = [...parUsine.entries()]
    .map(([usineCode, comps]) => ({
      usineCode,
      parcours: parcoursPour(usineCode, aAssemblage),
      quantite: Number(quantite),
      composants: comps,
    }))
    // ADMEDCO d'abord : c'est lui qui fournit la structure, donc lui
    // qui ouvre le bal. L'ordre est stable, pour que l'affichage et
    // les tests ne dépendent pas de l'ordre de lecture des lignes.
    .sort((a, b) => (a.usineCode === b.usineCode ? 0 : a.usineCode === "ADMEDCO" ? -1 : 1));

  return { repartitions, nonClassee };
};

/**
 * Où la part de chaque usine est destinée à finir.
 *
 *   MOBILIX     → livraison directe (le tapissage est la dernière
 *                 opération : la chaise y est finie)
 *   ADMEDCO     → rejoint MOBILIX si le produit contient du mou,
 *                 sinon livraison directe depuis le stock PF
 *
 * C'est la décision « envoyer à MOBILIX ou livrer directement »
 * décrite par l'exploitant, rendue explicite plutôt qu'implicite.
 */
export const destinationPart = (
  usine: UsineCode,
  triage: ResultatTriage,
): "MOBILIX" | "CLIENT_DIRECT" | "STOCK_PF" => {
  if (usine === "MOBILIX") return "CLIENT_DIRECT";
  const aDuMou = triage.repartitions.some((r) => r.usineCode === "MOBILIX");
  return aDuMou ? "MOBILIX" : "STOCK_PF";
};
