// ── Usines, ateliers, dépôts — ADMEDCO (A1, A2) + MOBILIX (M1) ──
// Chaque usine a son stock MP centrale séparé + ses stocks ateliers.

export type UsineCode = "ADMEDCO" | "MOBILIX";

export const USINES: Array<{ code: UsineCode; nom: string; accent: string }> = [
  { code: "ADMEDCO", nom: "Usine ADMEDCO — Production", accent: "#4a7c59" },
  { code: "MOBILIX", nom: "Usine MOBILIX — Réception & Finition", accent: "#7c3aed" },
];

export const usineAccent = (code: string | null | undefined): string =>
  USINES.find((u) => u.code === code)?.accent ?? "#4a7c59";

export const usineNom = (code: string | null | undefined): string =>
  USINES.find((u) => u.code === code)?.nom ?? "Usine ADMEDCO — Production";

// ── Ateliers ──
// ADMEDCO : A1 (lourd / tôle) et A2 (bureau) sont deux ateliers de
// FABRICATION parallèles. A3, le troisième atelier, assure le poudrage ET
// l'emballage pour les deux.
//
// ORDRE RETENU : ON POUDRE AVANT DE MONTER. La pièce passe donc DEUX FOIS
// à l'Atelier 3, et A2 assemble des pièces déjà peintes.
//
//   A1 (tôle) ─┐
//              ├─→ A3 phase 1 (poudrage) → A2 (montage) → A3 phase 2 (emballage) → Stock PF
//   A2 (métal) ┘
//
// Voir src/lib/etapes.ts pour les gammes détaillées de A2 et de A3.
//
// ⚠️ A3 porte l'id 4, pas 3 : l'id 3 est déjà MOBILIX (M1) depuis 0012.
// Le réattribuer réécrirait l'atelier_id de tout l'historique de
// production MOBILIX. Le numéro affiché reste « Atelier 3 » ; c'est
// `id` qui est la clé technique, et MOBILIX se désigne toujours par son
// nom, jamais par un numéro.
export const ATELIERS = [
  { id: 1 as const, code: "A1", nom: "Atelier 1 — Tôle & Gros œuvre", description: "Pièces lourdes : coupe, perçage, soudage", usine: "ADMEDCO" as UsineCode },
  { id: 2 as const, code: "A2", nom: "Atelier 2 — Bureau", description: "Montage du mobilier de bureau sur pièces poudrées", usine: "ADMEDCO" as UsineCode },
  { id: 4 as const, code: "A3", nom: "Atelier 3 — Poudrage & Emballage", description: "Poudrage (phase 1) puis emballage (phase 2) — travaille pour A1 et A2", usine: "ADMEDCO" as UsineCode },
  { id: 3 as const, code: "M1", nom: "Atelier MOBILIX 1 — Découpe bois", description: "Bois, inserts, piètement et assemblage final", usine: "MOBILIX" as UsineCode },
  { id: 5 as const, code: "M2", nom: "Atelier MOBILIX 2 — Tapissage", description: "Coupe, couture (A→H), rembourrage et emballage", usine: "MOBILIX" as UsineCode },
];

export type AtelierId = 1 | 2 | 3 | 4 | 5;

export type AtelierCode = "A1" | "A2" | "A3" | "M1" | "M2";

// Les deux ateliers de fabrication d'ADMEDCO (A1 tôle, A2 bureau)…
export const ATELIERS_FABRICATION: AtelierId[] = [1, 2];
// …et l'atelier de finition partagé où ils convergent.
export const ATELIER_FINITION: AtelierId = 4;

export const estAtelierFinition = (id: number | null | undefined): boolean => id === ATELIER_FINITION;

export const atelierNom = (id: number | null | undefined) =>
  ATELIERS.find((a) => a.id === id)?.nom ?? "Aucun atelier";

export const atelierUsine = (id: number | null | undefined): UsineCode =>
  ATELIERS.find((a) => a.id === id)?.usine ?? "ADMEDCO";

export const SOCIETE = "ADMEDCO";

// ── Dépôts ──
// ADMEDCO → DEP-MP (centrale), DEP-A1 (tôle), DEP-A2 (bureau), DEP-A3 (poudrage)
// MOBILIX → DEP-MP-MBX (centrale), DEP-M1
export const DEPOTS = [
  { code: "DEP-MP", nom: "Stock Matière Première — Centrale", detail: "Alimente Atelier 1 + Atelier 2 au début" },
  { code: "DEP-A1", nom: "Stock Atelier 1 — Tôle", detail: "Ce que l'Atelier 1 a produit, en attente de poudrage" },
  { code: "DEP-A2", nom: "Stock Atelier 2 — Bureau", detail: "Produit monté par l'Atelier 2, en attente d'emballage à l'Atelier 3" },
  { code: "DEP-A3", nom: "Stock Atelier 3 — Poudrage", detail: "Pièces poudrées attendant leur montage (A2) ou leur emballage" },
  { code: "DEP-MP-MBX", nom: "Stock Matière Première — Centrale MOBILIX", detail: "Alimente les ateliers MOBILIX (M1 et M2)" },
  { code: "DEP-M1", nom: "Stock Atelier MOBILIX 1 — Découpe bois", detail: "Bois, inserts et piètement préparés par M1" },
  { code: "DEP-M2", nom: "Stock Atelier MOBILIX 2 — Tapissage", detail: "Ce que M2 a tapissé et emballé" },
  { code: "DEP-ENCOURS-ADM", nom: "En-cours parcé — ADMEDCO", detail: "Travaux commencés et mis en attente pour une commande urgente" },
  { code: "DEP-ENCOURS-MBX", nom: "En-cours parcé — MOBILIX", detail: "Travaux commencés et mis en attente pour une commande urgente" },
] as const;

export type DepotCode =
  | "DEP-MP" | "DEP-A1" | "DEP-A2" | "DEP-A3"
  | "DEP-MP-MBX" | "DEP-M1" | "DEP-M2"
  | "DEP-ENCOURS-ADM" | "DEP-ENCOURS-MBX" | "DEP-PF";

export const depotNom = (code: string | null | undefined) =>
  DEPOTS.find((d) => d.code === code)?.nom ?? "Matière Première";

const DEPOTS_MOBILIX: ReadonlySet<string> = new Set([
  "DEP-MP-MBX", "DEP-M1", "DEP-M2", "DEP-ENCOURS-MBX",
]);

export const depotUsine = (code: string | null | undefined): UsineCode =>
  DEPOTS_MOBILIX.has(code ?? "") ? "MOBILIX" : "ADMEDCO";
