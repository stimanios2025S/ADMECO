// ── Réservation MP : besoin matière + emprunts inter-commandes ──
// Code pur, sans import supabase.

/**
 * Agrège le besoin matière total pour une quantité à produire,
 * à partir des templates de gamme (standard_materials + branch_insert_materials
 * de la branche optionnelle quand has_branch est vrai), multiplié par la quantité.
 * Arrondi à 3 décimales.
 */
export function calculBesoinMP(templates: any[], quantite: number): Array<{ material: string; qty: number; unit: string }> {
  const besoin = new Map<string, { material: string; qty: number; unit: string }>();
  const collecter = (matieres: any) => {
    for (const m of (matieres ?? []) as any[]) {
      const nom = typeof m?.material === "string" ? m.material.trim() : "";
      const qte = Number(m?.qty);
      if (!nom || !Number.isFinite(qte) || qte <= 0) continue;
      const ajout = +(qte * Number(quantite || 0)).toFixed(3);
      const precedent = besoin.get(nom);
      besoin.set(nom, {
        material: nom,
        qty: +(((precedent?.qty ?? 0) + ajout).toFixed(3)),
        unit: typeof m?.unit === "string" && m.unit ? m.unit : (precedent?.unit ?? "pcs"),
      });
    }
  };
  for (const t of templates ?? []) {
    collecter((t as any).standard_materials);
    if ((t as any).has_branch) collecter((t as any).branch_insert_materials);
  }
  return Array.from(besoin.values());
}

/**
 * Message français d'alerte d'emprunt de réserve :
 * la commande cible emprunte de la matière réservée à la commande source.
 */
export function messageEmprunt(orderNumSource: string, orderNumCible: string, material: string, qty: number, unit: string): string {
  return (
    `⚠️ Emprunt de réserve : ${qty} ${unit} de « ${material} » — ` +
    `la commande ${orderNumCible} emprunte sur la réserve de la commande ${orderNumSource}. ` +
    `À régulariser à la prochaine réception MP.`
  );
}
