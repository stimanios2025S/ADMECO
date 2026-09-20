// ═══════════════════════════════════════════════════════════
// LES PORTAILS D'ATELIER — identité, adresse, gammes
//
// ── Ce que ce fichier résout ──
//
// Chaque atelier a désormais SA page, avec SA couleur et SES
// postes : l'ouvrier se connecte, il arrive chez lui.
//
//        ADMEDCO                          MOBILIX
//     /atelier/a1  Tôle                /atelier/m1  Bois
//     /atelier/a2  Bureau              /atelier/m2  Tapissage
//     /atelier/a3  Poudrage & Emballage
//
// ── Le piège de l'identifiant ──
// Les `id` de la table `ateliers` ne suivent PAS l'ordre
// d'affichage : l'Atelier 3 (poudrage) porte l'id 4, et MOBILIX 1
// (bois) porte l'id 3. C'est historique et volontaire — réattribuer
// l'id 3 réécrirait tout l'historique MOBILIX (voir ateliers.ts).
//
// D'où la double table ci-dessous : `id` est la clé TECHNIQUE (celle
// écrite dans work_order_steps.atelier_id), `slug` est l'ADRESSE
// lisible. On ne dérive jamais l'un de l'autre par calcul — on les
// associe explicitement, sinon l'Atelier 3 finirait à /atelier/a4.
// ═══════════════════════════════════════════════════════════

import { ATELIERS, type AtelierId, type AtelierCode, type UsineCode } from "./ateliers";
import type { EtapeDef } from "./etapes";
import { ETAPES_A2, ETAPES_A3 } from "./etapes";
import { ETAPES_A1_GAMME } from "./process-eco";
import { ETAPES_M1_BOIS, ETAPES_M2_TAPISSAGE } from "./process-mobilix";

export type SlugAtelier = "a1" | "a2" | "a3" | "m1" | "m2";

// ── L'adresse ↔ l'identifiant technique ──
const SLUG_VERS_ID: Record<SlugAtelier, AtelierId> = {
  a1: 1,
  a2: 2,
  a3: 4, // ← Atelier 3 = id 4, pas 3
  m1: 3, // ← MOBILIX 1 = id 3
  m2: 5,
};

const ID_VERS_SLUG: Record<AtelierId, SlugAtelier> = {
  1: "a1",
  2: "a2",
  4: "a3",
  3: "m1",
  5: "m2",
};

/** L'atelier d'un slug d'URL, ou `null` si le slug n'existe pas. */
export const atelierDuSlug = (slug: string | null | undefined): AtelierId | null => {
  const s = (slug ?? "").trim().toLowerCase();
  return s in SLUG_VERS_ID ? SLUG_VERS_ID[s as SlugAtelier] : null;
};

/** Le slug d'URL d'un atelier, ou `null` si l'id n'est pas un atelier connu. */
export const slugAtelier = (id: number | null | undefined): SlugAtelier | null => {
  if (id === null || id === undefined) return null;
  return ID_VERS_SLUG[id as AtelierId] ?? null;
};

/** L'adresse du portail d'un atelier — le travail, une fois connecté. */
export const urlAtelier = (id: number | null | undefined): string => {
  const s = slugAtelier(id);
  return s ? `/atelier/${s}` : "/atelier";
};

/**
 * Le segment d'URL d'une usine : « admedco », « mobilix ».
 * C'est la PREMIÈRE chose qu'on choisit, avant l'atelier.
 */
export const segmentUsine = (usine: UsineCode): string => usine.toLowerCase();

/** L'usine d'un segment d'URL, ou `null` si le segment n'en désigne aucune. */
export const usineDuSegment = (segment: string | null | undefined): UsineCode | null => {
  const s = (segment ?? "").trim().toLowerCase();
  const u = USINES_AFFICHEES.find((x) => segmentUsine(x.code) === s);
  return u ? u.code : null;
};

/** L'adresse du portail d'une usine : `/portail/admedco`. */
export const urlPortailUsine = (usine: UsineCode | null | undefined): string =>
  usine ? `/portail/${segmentUsine(usine)}` : "/portail";

/**
 * L'adresse de CONNEXION d'un atelier : `/portail/admedco/a1`.
 *
 * ── Trois adresses, trois métiers ──
 *
 *   /portail                 les deux usines      (public)
 *   /portail/<usine>         les ateliers         (public)
 *   /portail/<usine>/<slug>  la connexion         (public)
 *   /atelier/<slug>          le travail            (privé)
 *
 * ── Pourquoi l'usine est dans l'adresse ──
 * Parce que c'est la séparation qui compte : ADMEDCO fabrique le dur,
 * MOBILIX la chaise tapissée, et personne ne travaille dans les deux.
 * Mettre l'usine dans le CHEMIN rend impossible d'ouvrir un atelier
 * MOBILIX depuis le portail ADMEDCO — l'adresse elle-même le refuse,
 * avant même que la base ait à trancher.
 *
 * Un ouvrier qui se déconnecte revient donc sur la porte de SON
 * atelier, à sa couleur, et pas sur un écran générique où il devrait
 * le retrouver dans une liste.
 */
export const urlConnexionAtelier = (id: number | null | undefined): string => {
  const f = ficheAtelier(id);
  return f ? `/portail/${segmentUsine(f.usine)}/${f.slug}` : "/portail";
};

/** Tous les slugs d'atelier, dans l'ordre d'affichage. */
export const tousLesSlugs: SlugAtelier[] = ["a1", "a2", "a3", "m1", "m2"];

// ═══════════════════════════════════════════════════════════
// LA FICHE D'UN ATELIER
// ═══════════════════════════════════════════════════════════

export type FicheAtelier = {
  id: AtelierId;
  slug: SlugAtelier;
  /** A1, A2, A3, M1, M2 — jamais « Atelier 4 ». */
  code: AtelierCode;
  /** Le numéro AFFICHÉ : 1, 2, 3 (A3), ou rien pour MOBILIX. */
  numero: string;
  nom: string;
  court: string;
  usine: UsineCode;
  emoji: string;
  accent: string;
  /** Une phrase : ce que l'atelier FAIT, pour l'en-tête du portail. */
  role: string;
  /** Ses postes, dans l'ordre où l'ouvrier les lit. */
  gammes: EtapeDef[];
};

const FICHES: Record<AtelierId, FicheAtelier> = {
  1: {
    id: 1,
    slug: "a1",
    code: "A1",
    numero: "1",
    nom: "Atelier 1 — Tôle & Gros œuvre",
    court: "Tôle & Gros œuvre",
    usine: "ADMEDCO",
    emoji: "🪚",
    accent: "#c24a08",
    role: "Coupe, perçage, soudage. La pièce part ensuite au poudrage (Atelier 3).",
    gammes: ETAPES_A1_GAMME,
  },
  2: {
    id: 2,
    slug: "a2",
    code: "A2",
    numero: "2",
    nom: "Atelier 2 — Bureau",
    court: "Bureau",
    usine: "ADMEDCO",
    emoji: "🔧",
    accent: "#2f6eb5",
    role: "Monte le mobilier sur des pièces DÉJÀ poudrées par l'Atelier 3.",
    gammes: ETAPES_A2,
  },
  4: {
    id: 4,
    slug: "a3",
    code: "A3",
    numero: "3",
    nom: "Atelier 3 — Poudrage & Emballage",
    court: "Poudrage & Emballage",
    usine: "ADMEDCO",
    emoji: "🎨",
    accent: "#0f766e",
    role: "Reçoit l'Atelier 1 et l'Atelier 2 en deux passes : poudrage, puis emballage.",
    gammes: ETAPES_A3,
  },
  3: {
    id: 3,
    slug: "m1",
    code: "M1",
    numero: "",
    nom: "MOBILIX 1 — Découpe bois",
    court: "Découpe bois",
    usine: "MOBILIX",
    emoji: "🪵",
    accent: "#7c3aed",
    role: "Bois, inserts, piètement. Travaille pour G21 et Canada.",
    gammes: ETAPES_M1_BOIS,
  },
  5: {
    id: 5,
    slug: "m2",
    code: "M2",
    numero: "",
    nom: "MOBILIX 2 — Tapissage",
    court: "Tapissage",
    usine: "MOBILIX",
    emoji: "🧵",
    accent: "#c026d3",
    role: "Coupe, couture, rembourrage et emballage de la chaise.",
    gammes: ETAPES_M2_TAPISSAGE,
  },
};

export const ficheAtelier = (id: number | null | undefined): FicheAtelier | null =>
  id === null || id === undefined ? null : (FICHES[id as AtelierId] ?? null);

/** Les fiches, dans l'ordre d'affichage : ADMEDCO puis MOBILIX, A1 → A3, M1 → M2. */
export const FICHES_ATELIERS: FicheAtelier[] = [FICHES[1], FICHES[2], FICHES[4], FICHES[3], FICHES[5]];

export const fichesParUsine = (usine: UsineCode): FicheAtelier[] =>
  FICHES_ATELIERS.filter((f) => f.usine === usine);

export const USINES_AFFICHEES: Array<{ code: UsineCode; nom: string; sousTitre: string; accent: string }> = [
  { code: "ADMEDCO", nom: "ADMEDCO", sousTitre: "Tôle, bureau, poudrage & emballage", accent: "#4a7c59" },
  { code: "MOBILIX", nom: "MOBILIX", sousTitre: "Chaise tapissée G21 & Canada", accent: "#7c3aed" },
];

// ── Le nom affiché d'un atelier, partout, sans jamais écrire « A4 » ──
export const nomCourtAtelier = (id: number | null | undefined): string =>
  ficheAtelier(id)?.court ?? "Aucun atelier";

export const codeAtelier = (id: number | null | undefined): AtelierCode | null =>
  ficheAtelier(id)?.code ?? null;

export const accentAtelier = (id: number | null | undefined): string =>
  ficheAtelier(id)?.accent ?? "#4a7c59";

/** Libellé d'un poste tel que l'ouvrier le lit : « 3 · Soudage ». */
export const libellePoste = (id: number | null | undefined, ordre: number): string => {
  const f = ficheAtelier(id);
  if (!f) return `Étape ${ordre}`;
  const e = f.gammes.find((x) => x.ordre === ordre);
  // MOBILIX ne parle pas d'« étapes » mais de POSTES numérotés 1..12.
  const prefixe = f.usine === "MOBILIX" ? "Poste" : "Étape";
  return e ? `${prefixe} ${ordre} · ${e.nom}` : `${prefixe} ${ordre}`;
};

// ── Vérification du chevauchement des gammes ──
// Plusieurs ateliers partagent des numéros d'étape (M2 a des postes 1..4
// ET 5..12 ; A3 a deux phases). Un poste marqué « 4 » ne veut donc rien
// dire hors de son atelier : c'est `atelier_id` qui tranche, jamais
// `step_order`. Cette fonction sert aux écrans d'alerte, pas au routage.
export const memesPostes = (a: number | null, b: number | null): boolean => {
  const fa = ficheAtelier(a);
  const fb = ficheAtelier(b);
  if (!fa || !fb) return false;
  return fa.gammes.some((x) => fb.gammes.some((y) => y.ordre === x.ordre));
};

/** Le nombre de postes d'un atelier, pour l'en-tête (« 7 postes »). */
export const nbPostes = (id: number | null | undefined): number => ficheAtelier(id)?.gammes.length ?? 0;

/** Les ateliers d'une usine, en fiches. Sert au garde-fou anti-mélange. */
export const ateliersDeUsine = (usine: UsineCode): AtelierId[] =>
  ATELIERS.filter((a) => a.usine === usine).map((a) => a.id);
