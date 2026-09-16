import { createServerSupabase } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import PageClient from "./PageClient";

export const dynamic = "force-dynamic";

// NOMENCLATURES — miroir COM_Formula + COM_BOM : recettes de fabrication
export default async function NomenclaturesPage() {
  const supabase = createServerSupabase();
  const { data: lignes } = await supabase
    .from("v_erp_nomenclature_detail")
    .select("*")
    .order("pf_designation")
    .limit(5000);
  const { data: couts } = await supabase.from("v_erp_cout_nomenclature").select("*");
  return (
    <AdminShell pageTitle="Nomenclatures" pageHint="Recettes Silwane importées — chaque produit fabriqué et ses composants avec quantités et coût matière estimé.">
      <PageClient lignes={lignes ?? []} couts={couts ?? []} />
    </AdminShell>
  );
}
