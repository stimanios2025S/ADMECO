import { createServerSupabase } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import PageClient from "./PageClient";

export const dynamic = "force-dynamic";

// ARTICLES — miroir COM_Item (code, désignation, famille, prix, stocks, seuils, blocage)
export default async function ArticlesPage() {
  const supabase = createServerSupabase();
  const [{ data: articles }, { data: familles }] = await Promise.all([
    supabase.from("erp_articles").select("*, erp_familles(nom)").order("designation"),
    supabase.from("erp_familles").select("*").order("nom"),
  ]);
  return (
    <AdminShell pageTitle="Articles" pageHint="Référentiel articles ADMEDCO — recopie COM_Item Silwane : matières, produits, quincaillerie.">
      <PageClient articles={articles ?? []} familles={familles ?? []} />
    </AdminShell>
  );
}
