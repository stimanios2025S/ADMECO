import { createServerSupabase } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import PageClient from "./PageClient";

export const dynamic = "force-dynamic";

// LOTS — miroir COM_Batch + COM_SerialNumber
export default async function LotsPage() {
  const supabase = createServerSupabase();
  const [{ data: lots }, { data: articles }, { data: depots }] = await Promise.all([
    supabase.from("erp_lots").select("*, erp_articles(designation,code), erp_depots(nom,code)").order("created_at", { ascending: false }).limit(200),
    supabase.from("erp_articles").select("id,designation,code").order("designation"),
    supabase.from("erp_depots").select("id,nom,code").order("code"),
  ]);
  return (
    <AdminShell pageTitle="Lots" pageHint="Lots et numéros de série ADMEDCO — recopie COM_Batch / COM_SerialNumber.">
      <PageClient lots={lots ?? []} articles={articles ?? []} depots={depots ?? []} />
    </AdminShell>
  );
}
