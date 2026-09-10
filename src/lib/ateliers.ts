export const ATELIERS = [
  { id: 1 as const, code: "A1", nom: "Atelier 1 — Bois & Découpe", description: "Découpe, usinage, préparation" },
  { id: 2 as const, code: "A2", nom: "Atelier 2 — Assemblage & Finition", description: "Assemblage, soudage, poudrage, montage" },
];

export type AtelierId = 1 | 2;

export const atelierNom = (id: number | null | undefined) =>
  ATELIERS.find((a) => a.id === id)?.nom ?? "Aucun atelier";

export const SOCIETE = "ADMEDCO";

// ── 3 stocks : MP centrale (alimente A1+A2 au début), Stock A1 (produit par A1), Stock A2 (produit par A2) ──
export const DEPOTS = [
  { code: "DEP-MP", nom: "Stock Matière Première — Centrale", detail: "Alimente Atelier 1 + Atelier 2 au début" },
  { code: "DEP-A1", nom: "Stock Atelier 1", detail: "Ce que l'Atelier 1 a produit" },
  { code: "DEP-A2", nom: "Stock Atelier 2", detail: "Ce que l'Atelier 2 a produit" },
] as const;

export type DepotCode = "DEP-MP" | "DEP-A1" | "DEP-A2";

export const depotNom = (code: string | null | undefined) =>
  DEPOTS.find((d) => d.code === code)?.nom ?? "Matière Première";
