// ── Réception MP : parseur de facture + classement familles ──
// Code pur, sans import supabase.

/**
 * Classe une désignation fournisseur dans un code famille article.
 * Familles : FAM-MP (matières premières, défaut), FAM-QCA (quincaillerie),
 * FAM-CHA (chaises), FAM-TAB (tables), FAM-ARM (armoires),
 * FAM-FAU (fauteuils), FAM-PME (pieds métal).
 */
export function classerFamille(designation: string): string {
  const d = (designation ?? "").toLowerCase();
  if (/chaise/.test(d)) return "FAM-CHA";
  if (/table/.test(d)) return "FAM-TAB";
  if (/armoire|placard|vestiaire|rayonnage|biblioth[eè]que/.test(d)) return "FAM-ARM";
  if (/fauteuil|canap[eé]|banquette/.test(d)) return "FAM-FAU";
  if (/pied|tube|profil[eé]|t[oô]le|acier|inox|aluminium|corni[eè]re|soud/.test(d)) return "FAM-PME";
  if (/vis|boulon|[eé]crou|charni[eè]re|quincaillerie|poign[eé]e|coulisse|cheville|serrure|gond|paumelle|fixation/.test(d)) return "FAM-QCA";
  return "FAM-MP";
}

/**
 * Parseur heuristique d'un texte de facture copié/collé (ou .txt/.csv lu côté client).
 * Formats acceptés par ligne : « désignation;quantité;prix » (séparateurs ; , | tabulation),
 * ou « désignation quantité [unité] [à|@|x prix] ». Les lignes de totaux sont ignorées.
 * Tolérant : lignes sans nombres ignorées, prix manquant = 0.
 */
export function parserFactureTexte(texte: string): { fournisseurNom: string; numeroFacture: string; lignes: Array<{ designation: string; quantite: number; prixUnitaire: number }> } {
  const brut = texte ?? "";
  const lignesBrutes = brut
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let fournisseurNom = "";
  const mF = brut.match(/fournisseur\s*:?\s*(.+)/i)?.[1]?.trim();
  if (mF) fournisseurNom = mF.slice(0, 80);
  if (!fournisseurNom && lignesBrutes.length > 0 && !/\d/.test(lignesBrutes[0] ?? "")) {
    fournisseurNom = (lignesBrutes[0] ?? "").slice(0, 80);
  }
  if (!fournisseurNom) fournisseurNom = "Fournisseur inconnu";

  const numeroFacture =
    brut.match(/(?:facture|n°|numero|numéro|nº)\s*:?\s*([A-Za-z0-9][A-Za-z0-9\-_/]*)/i)?.[1]?.trim() ?? "";

  const lignes: Array<{ designation: string; quantite: number; prixUnitaire: number }> = [];
  for (const l of lignesBrutes) {
    if (/fournisseur|facture|total|tva|montant|net\s*[aà]|date|t[eé]l[eé]phone|\btel\b|nif|adresse/i.test(l)) continue;
    const parties = l.split(/[;|\t]/).map((p) => p.trim()).filter(Boolean);
    let designation = "";
    let quantite = NaN;
    let prix = 0;
    if (parties.length >= 2) {
      designation = parties[0] ?? "";
      quantite = parseFloat((parties[1] ?? "").replace(/\s/g, "").replace(",", "."));
      if (parties.length >= 3) {
        const p = parseFloat((parties[2] ?? "").replace(/\s/g, "").replace(",", "."));
        if (!Number.isNaN(p)) prix = p;
      }
    } else {
      const m = l.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(pcs|kg|m2|m²|m|l|t|barre|feuille|rouleau)?(?:\s+(?:à|@|x|×)\s*(\d+(?:[.,]\d+)?))?\s*$/i);
      if (!m) continue;
      designation = (m[1] ?? "").trim();
      quantite = parseFloat((m[2] ?? "").replace(",", "."));
      if (m[4]) {
        const p = parseFloat(m[4].replace(",", "."));
        if (!Number.isNaN(p)) prix = p;
      }
    }
    if (!designation || Number.isNaN(quantite) || !(quantite > 0)) continue;
    lignes.push({ designation, quantite, prixUnitaire: prix });
  }

  return { fournisseurNom, numeroFacture, lignes };
}
