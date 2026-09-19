import { createServerSupabase } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import PageClient from "./PageClient";

export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════
// RENDEMENTS MATIÈRE — « une unité de matière donne N pièces »
//
// C'est la SEULE donnée que le système ne peut pas déduire : elle
// vient de l'atelier, pas de la nomenclature. Sans elle, l'agent
// matière suppose 1 pour 1 et le signale ; avec elle, « 300 chaises »
// se traduit enfin en « combien de barres sortir du stock ».
//
// ⚠️ Elle est propre à chaque USINE : la barre ADMEDCO n'est pas la
//    barre MOBILIX. Le même article peut donc porter deux rendements.
//
// La table `rendement_matiere` démarre VIDE (migration 0017) : rien
// n'est inventé ici. C'est cet écran qui la remplit, un rendement à
// la fois, au fur et à mesure que l'usine les communique.
// ═══════════════════════════════════════════════════════════

export default async function RendementsPage() {
  const supabase: any = createServerSupabase();

  const [rend, matieres, produits] = await Promise.all([
    supabase
      .from("rendement_matiere")
      .select("id, usine_code, article_id, produit_id, unites_produites, unite_matiere, unite_produit, note, actif")
      .order("usine_code")
      .limit(1000),
    supabase
      .from("erp_articles")
      .select("id, code, designation, unite")
      .eq("est_mp", true)
      .order("code")
      .limit(2000),
    supabase
      .from("erp_articles")
      .select("id, code, designation, unite")
      .or("est_fabrique.eq.true,est_semi_fini.eq.true")
      .order("code")
      .limit(2000),
  ]);

  const article = (a: any) => ({ id: a.id, code: a.code ?? "", designation: a.designation ?? "", unite: a.unite ?? "pcs" });

  const erreur = rend.error?.message ?? matieres.error?.message ?? produits.error?.message ?? null;

  const avertissementMatieres =
    (matieres.data ?? []).length === 0
      ? "Aucun article marqué « matière première » (est_mp). L'import Silwane ne l'a peut-être pas renseigné : voir /admin/articles."
      : (produits.data ?? []).length === 0
        ? "Aucun article marqué « fabriqué » ou « semi-fini » : aucun produit à rattacher à un rendement."
        : null;

  return (
    <AdminShell
      pageTitle="Rendements matière"
      pageHint="Combien de pièces une unité de matière donne. Propre à chaque usine. Tant qu'une valeur manque, l'agent suppose 1 pour 1 et le signale."
    >
      <PageClient
        rendements={(rend.data ?? []).map((r: any) => ({
          id: r.id,
          usine: r.usine_code ?? "ADMEDCO",
          articleId: r.article_id,
          produitId: r.produit_id ?? null,
          unitesProduites: Number(r.unites_produites) || 1,
          uniteMatiere: r.unite_matiere ?? "pcs",
          uniteProduit: r.unite_produit ?? "pcs",
          note: r.note ?? "",
          actif: r.actif !== false,
        }))}
        matieres={(matieres.data ?? []).map(article)}
        produits={(produits.data ?? []).map(article)}
        erreur={erreur}
        avertissement={avertissementMatieres}
      />
    </AdminShell>
  );
}
