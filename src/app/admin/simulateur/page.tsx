import { createServerSupabase } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import PageClient from "./PageClient";

export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════
// SIMULATEUR DE CHAÎNE — voir ce que la production fera, avant
// ═══════════════════════════════════════════════════════════
//
// Cette page ne sert qu'à LIRE. Elle ne lance rien, ne réserve
// rien, n'écrit rien : elle déroule le triage, la route et le plan
// matière du produit choisi et montre le résultat.
//
// ── Pourquoi la lecture est paginée ──
//
// PostgREST plafonne le nombre de lignes d'une réponse. Un
// `.select()` nu sur `erp_nomenclatures` (5 000+ lignes) renverrait
// les mille premières SANS erreur — et le catalogue des produits
// serait amputé d'autant, en silence. On lit donc par tranches
// jusqu'à épuisement.

const TRANCHE = 1000;
const PLAFOND = 50_000;

/** Lit une table entière par tranches, sans jamais tronquer en silence. */
async function lireTout(
  supabase: any,
  table: string,
  colonnes: string,
): Promise<{ lignes: any[]; erreur: string | null }> {
  const lignes: any[] = [];
  for (let debut = 0; debut < PLAFOND; debut += TRANCHE) {
    const { data, error } = await supabase
      .from(table)
      .select(colonnes)
      .range(debut, debut + TRANCHE - 1);
    if (error) return { lignes, erreur: error.message };
    const recues = data ?? [];
    lignes.push(...recues);
    if (recues.length < TRANCHE) break;
  }
  return { lignes, erreur: null };
}

export default async function SimulateurPage() {
  const supabase: any = createServerSupabase();

  const [articles, nomen] = await Promise.all([
    lireTout(supabase, "erp_articles", "id, code, designation, unite, est_fabrique, est_semi_fini"),
    lireTout(supabase, "erp_nomenclatures", "article_id"),
  ]);

  // Un produit est simulable s'il est DÉCLARÉ fabriqué ou s'il
  // apparaît comme parent dans la nomenclature. Le second critère
  // rattrape les articles dont Silwane n'a pas coché le drapeau
  // alors que la recette existe — même règle que l'agent matière.
  const parents = new Set<string>();
  for (const l of nomen.lignes) if (l.article_id) parents.add(l.article_id);

  const catalogue = articles.lignes
    .filter((a: any) => a.est_fabrique || a.est_semi_fini || parents.has(a.id))
    .map((a: any) => ({
      id: a.id as string,
      code: a.code ?? "",
      designation: a.designation ?? "",
      unite: a.unite ?? "pcs",
      nbComposants: 0,
    }))
    .sort((a, b) => a.code.localeCompare(b.code, "fr"));

  const nbComposants = new Map<string, number>();
  for (const l of nomen.lignes) {
    if (!l.article_id) continue;
    nbComposants.set(l.article_id, (nbComposants.get(l.article_id) ?? 0) + 1);
  }
  for (const a of catalogue) a.nbComposants = nbComposants.get(a.id) ?? 0;

  const erreur = articles.erreur ?? nomen.erreur ?? null;

  return (
    <AdminShell
      pageTitle="Simulateur de chaîne"
      pageHint="Choisissez un produit : le simulateur déroule le triage, la route et la matière — sans rien lancer ni réserver."
    >
      <PageClient catalogue={catalogue} erreur={erreur} />
    </AdminShell>
  );
}
