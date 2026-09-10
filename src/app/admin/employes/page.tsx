import { createServerSupabase } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import PageClient from "./PageClient";

export const dynamic = "force-dynamic";

// EMPLOYÉS — miroir HRM_Employee
export default async function EmployesPage() {
  const supabase = createServerSupabase();
  const { data } = await supabase.from("erp_employes").select("*").order("nom");
  return (
    <AdminShell pageTitle="Employés" pageHint="Personnel ADMEDCO — recopie HRM_Employee Silwane, par atelier.">
      <PageClient employes={data ?? []} />
    </AdminShell>
  );
}
