import { createServerSupabase } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import PageClient from "./PageClient";

export const dynamic = "force-dynamic";

// MACHINES — miroir Prod_Machine + Prod_MachineFamily
export default async function MachinesPage() {
  const supabase = createServerSupabase();
  const { data } = await supabase.from("erp_machines").select("*").order("code");
  return (
    <AdminShell pageTitle="Machines" pageHint="Parc machines ADMEDCO — recopie Prod_Machine Silwane, par atelier.">
      <PageClient machines={data ?? []} />
    </AdminShell>
  );
}
