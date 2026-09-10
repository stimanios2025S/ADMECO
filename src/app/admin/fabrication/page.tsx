import { createServerSupabase } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import PageClient from "./PageClient";

export const dynamic = "force-dynamic";

// FABRICATION — miroir Prod_Production (ordres de fabrication réels)
export default async function FabricationPage() {
  const supabase = createServerSupabase();
  const [{ data: ordres }, { data: articles }] = await Promise.all([
    supabase.from("erp_fabrication").select("*, erp_articles(designation,code)").order("created_at", { ascending: false }).limit(200),
    supabase.from("erp_articles").select("id,designation,code").order("designation"),
  ]);
  return (
    <AdminShell pageTitle="Fabrication" pageHint="Ordres de fabrication ADMEDCO — recopie Prod_Production Silwane, répartis A1 / A2.">
      <PageClient ordres={ordres ?? []} articles={articles ?? []} />
    </AdminShell>
  );
}
