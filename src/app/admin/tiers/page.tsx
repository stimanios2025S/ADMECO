import { createServerSupabase } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import PageClient from "./PageClient";

export const dynamic = "force-dynamic";

// TIERS — miroir COM_ThirdParty (clients / fournisseurs)
export default async function TiersPage() {
  const supabase = createServerSupabase();
  const { data } = await supabase.from("erp_tiers").select("*").order("raison_sociale");
  return (
    <AdminShell pageTitle="Tiers" pageHint="Clients et fournisseurs ADMEDCO — recopie COM_ThirdParty Silwane.">
      <PageClient tiers={data ?? []} />
    </AdminShell>
  );
}
