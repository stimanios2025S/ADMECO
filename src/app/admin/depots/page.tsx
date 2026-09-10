import { createServerSupabase } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import PageClient from "./PageClient";

export const dynamic = "force-dynamic";

// DÉPÔTS — miroir COM_Warehouse (DEP-A1 / DEP-A2 liés aux 2 ateliers)
export default async function DepotsPage() {
  const supabase = createServerSupabase();
  const { data } = await supabase.from("erp_depots").select("*").order("code");
  return (
    <AdminShell pageTitle="Dépôts" pageHint="Dépôts ADMEDCO — recopie COM_Warehouse Silwane, un par atelier.">
      <PageClient depots={data ?? []} />
    </AdminShell>
  );
}
