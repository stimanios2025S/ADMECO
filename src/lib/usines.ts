// ── Helpers multi-usines : ADMEDCO (production) + MOBILIX (réception & finition) ──
// Chaque usine a son stock MP centrale séparé + ses stocks ateliers.
// Destinations (décision Admin ADMEDCO) : MOBILIX | CLIENT_DIRECT.

import { USINES, usineAccent, usineNom } from "./ateliers";
import type { UsineCode } from "./ateliers";

export { USINES, usineAccent, usineNom };
export type { UsineCode };

export const isAdmedco = (code: string | null | undefined): boolean =>
  code === "ADMEDCO";

export const isMobilix = (code: string | null | undefined): boolean =>
  code === "MOBILIX";

// ── Destinations : libellés affichés ──
export type DestinationCode = "MOBILIX" | "CLIENT_DIRECT";

export const DESTINATION_LABELS: Record<DestinationCode, string> = {
  MOBILIX: "Envoyer à MOBILIX",
  CLIENT_DIRECT: "Livraison client direct",
};

export const destinationLabel = (destination: string | null | undefined): string =>
  (destination != null ? DESTINATION_LABELS[destination as DestinationCode] : undefined)
  ?? "Destination inconnue";

// ── Statuts d'un dossier destination ──
export type DestinationStatut = "DECIDE" | "EXPEDIE" | "LIVRE";

export const DESTINATION_STATUTS: Array<{ code: DestinationStatut; nom: string }> = [
  { code: "DECIDE", nom: "Décidé" },
  { code: "EXPEDIE", nom: "Expédié" },
  { code: "LIVRE", nom: "Livré" },
];

export const destinationStatutNom = (statut: string | null | undefined): string =>
  DESTINATION_STATUTS.find((s) => s.code === statut)?.nom ?? "Décidé";

// ── Dossier archive : un dossier destination est archivé une fois expédié ou livré ──
export const ARCHIVE_STATUTS: DestinationStatut[] = ["EXPEDIE", "LIVRE"];

export const estArchive = (statut: string | null | undefined): boolean =>
  ARCHIVE_STATUTS.includes(statut as DestinationStatut);

// ── Noms des vues SQL ──
export const VUES = {
  STOCK_STATUS: "v_stock_status",
  STOCK_ATELIERS: "v_stock_ateliers",
  STEP_VARIANCE: "v_step_variance",
  ERP_STOCK: "v_erp_stock",
  ERP_NOMENCLATURE_DETAIL: "v_erp_nomenclature_detail",
  ERP_COUT_NOMENCLATURE: "v_erp_cout_nomenclature",
} as const;

export type VueNom = (typeof VUES)[keyof typeof VUES];
