export const ATELIERS = [
  { id: 1 as const, code: "A1", nom: "Atelier 1 — Bois & Découpe", description: "Découpe, usinage, préparation" },
  { id: 2 as const, code: "A2", nom: "Atelier 2 — Assemblage & Finition", description: "Assemblage, soudage, poudrage, montage" },
];

export type AtelierId = 1 | 2;

export const atelierNom = (id: number | null | undefined) =>
  ATELIERS.find((a) => a.id === id)?.nom ?? "Aucun atelier";

export const SOCIETE = "ADMEDCO";
