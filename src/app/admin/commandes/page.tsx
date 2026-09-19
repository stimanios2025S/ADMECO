import { headers } from "next/headers";
import { createServerSupabase } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import PageClient from "./PageClient";

export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════
// COMMANDES CLIENT — le point d'entrée de tout le workflow
//
// La commande arrive par l'un des deux chemins décrits par
// l'exploitant :
//   • le client remplit lui-même depuis son lien à jeton
//   • l'admin la saisit pour lui
// Dans les deux cas elle atterrit ici, et c'est d'ici qu'on la
// TRIE : le dur part chez ADMEDCO, le mou chez MOBILIX.
// ═══════════════════════════════════════════════════════════

export default async function CommandesPage() {
  const supabase: any = createServerSupabase();

  const [commandes, lignes, articles] = await Promise.all([
    supabase
      .from("commandes_client")
      .select("id, numero, token, client_nom, client_telephone, client_email, origine, statut, total_estime, note, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("commande_client_lignes")
      .select("id, commande_id, article_id, designation, quantite, prix_unitaire, ligne_ordre")
      .order("ligne_ordre"),
    // Catalogue vendable : on ne propose que les articles FABRIQUÉS.
    // Proposer 12 000 matières premières dans une liste de vente
    // serait une faute — et noierait le produit fini.
    supabase
      .from("erp_articles")
      .select("id, code, designation, unite, prix_vente, est_fabrique, est_semi_fini")
      .or("est_fabrique.eq.true,est_semi_fini.eq.true")
      .order("code")
      .limit(800),
  ]);

  const parCommande = new Map<string, any[]>();
  for (const l of lignes.data ?? []) {
    const liste = parCommande.get(l.commande_id);
    if (liste) liste.push(l);
    else parCommande.set(l.commande_id, [l]);
  }

  const h = headers();
  const host = h.get("host") ?? "";
  const proto = (h.get("x-forwarded-proto") ?? "https").split(",")[0];
  const baseUrl = host ? `${proto}://${host}` : "";

  const liste = (commandes.data ?? []).map((c: any) => ({
    ...c,
    lignes: parCommande.get(c.id) ?? [],
  }));

  const catalogue = (articles.data ?? []).map((a: any) => ({
    id: a.id,
    code: a.code ?? "",
    designation: a.designation ?? "",
    unite: a.unite ?? "pcs",
    prix: Number(a.prix_vente) || 0,
  }));

  const erreur = commandes.error?.message ?? lignes.error?.message ?? articles.error?.message ?? null;

  return (
    <AdminShell
      pageTitle="Commandes client"
      pageHint="Le client commande depuis son lien, ou vous saisissez pour lui. Ensuite, on trie : ADMEDCO pour le dur, MOBILIX pour le mou."
    >
      <PageClient commandes={liste} catalogue={catalogue} baseUrl={baseUrl} erreur={erreur} />
    </AdminShell>
  );
}
