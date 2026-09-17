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

// ── Ateliers : 1 (A1, ADMEDCO), 2 (A2, ADMEDCO), 3 (M1, MOBILIX) ──
export const ATELIERS = [
  { id: 1 as const, code: "A1", nom: "Atelier 1 — Bois & Découpe", description: "Découpe, usinage, préparation", usine: "ADMEDCO" as UsineCode },
  { id: 2 as const, code: "A2", nom: "Atelier 2 — Assemblage & Finition", description: "Assemblage, soudage, poudrage, montage", usine: "ADMEDCO" as UsineCode },
  { id: 3 as const, code: "M1", nom: "Atelier MOBILIX — Réception & Finition", description: "Réception ADMEDCO, contrôle, finition, emballage", usine: "MOBILIX" as UsineCode },
];

export type AtelierId = 1 | 2 | 3;

export type AtelierCode = "A1" | "A2" | "M1";

export const atelierNom = (id: number | null | undefined) =>
  ATELIERS.find((a) => a.id === id)?.nom ?? "Aucun atelier";

export const atelierUsine = (id: number | null | undefined): UsineCode =>
  ATELIERS.find((a) => a.id === id)?.usine ?? "ADMEDCO";

export const SOCIETE = "ADMEDCO";

// ── Dépôts : ADMEDCO → DEP-MP (centrale), DEP-A1, DEP-A2 ; MOBILIX → DEP-MP-MBX (centrale), DEP-M1 ──
export const DEPOTS = [
  { code: "DEP-MP", nom: "Stock Matière Première — Centrale", detail: "Alimente Atelier 1 + Atelier 2 au début" },
  { code: "DEP-A1", nom: "Stock Atelier 1", detail: "Ce que l'Atelier 1 a produit" },
  { code: "DEP-A2", nom: "Stock Atelier 2", detail: "Ce que l'Atelier 2 a produit" },
  { code: "DEP-MP-MBX", nom: "Stock Matière Première — Centrale MOBILIX", detail: "Alimente l'Atelier MOBILIX (M1)" },
  { code: "DEP-M1", nom: "Stock Atelier MOBILIX", detail: "Ce que l'Atelier MOBILIX a réceptionné et fini" },
] as const;

export type DepotCode = "DEP-MP" | "DEP-A1" | "DEP-A2" | "DEP-MP-MBX" | "DEP-M1";

export const depotNom = (code: string | null | undefined) =>
  DEPOTS.find((d) => d.code === code)?.nom ?? "Matière Première";

export const depotUsine = (code: string | null | undefined): UsineCode =>
  code === "DEP-MP-MBX" || code === "DEP-M1" ? "MOBILIX" : "ADMEDCO";
