// Statuts techniques (base de données) → libellés français affichés.
export const STATUT_FR: Record<string, string> = {
  CREATED: "Créée",
  IN_PROGRESS: "En cours",
  PARTIAL_READY: "Partiellement prête",
  ALL_READY: "Prête",
  SEMI_READY: "Semi-finie",
  RELEASED: "Expédiée",
  CANCELLED: "Annulée",
  PENDING: "En attente",
  ACTIVE: "Active",
  DONE: "Terminée",
  SKIPPED: "Ignorée",
  PAUSED: "En pause",
  REWORK: "Reprise",
  VERIFIED: "Vérifiée",
  DELIVERED: "Livrée",
  TRANSFERRED: "Transférée",
  ADMIN: "Admin",
  WORKER: "Opérateur",
};

export const statutFr = (s: string) => STATUT_FR[s] ?? s.replace(/_/g, " ");

export const MOUVEMENT_FR: Record<string, string> = {
  reserve: "RÉSERVÉ",
  consume: "CONSOMMÉ",
  release: "LIBÉRÉ",
  adjust: "AJUSTÉ",
};

export const mouvementFr = (m: string) => MOUVEMENT_FR[m] ?? m.toUpperCase();
