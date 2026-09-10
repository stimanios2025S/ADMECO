import { createServerSupabase } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import PageClient from "./PageClient";

export const dynamic = "force-dynamic";

// INVENTAIRES — miroir COM_Inventory (écarts théorique / compté)
export default async function InventairesPage() {
  const supabase = createServerSupabase();
  const [{ data: inv }, { data: articles }, { data: depots }] = await Promise.all([
    supabase.from("erp_inventaires").select("*, erp_articles(designation), erp_depots(nom)").order("date_inventaire", { ascending: false }).limit(200),
    supabase.from("erp_articles").select("id,designation").order("designation"),
    supabase.from("erp_depots").select("id,nom").order("nom"),
  ]);
  return (
    <AdminShell pageTitle="Inventaires" pageHint="Inventaires ADMEDCO — recopie COM_Inventory : théorique contre compté, écarts.">
      <PageClient inv={inv ?? []} articles={articles ?? []} depots={depots ?? []} />
    </AdminShell>
  );
}
