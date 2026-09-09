import { createServerSupabase } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import IncidentsClient from "./IncidentsClient";

export const dynamic = "force-dynamic";

export default async function IncidentsPage() {
  const supabase = createServerSupabase();
  const [{ data: overdue }, { data: transfers }, { data: lowStock }] = await Promise.all([
    supabase.from("v_step_variance").select("*").gt("variance_min", 0).neq("status", "PENDING").order("variance_min", { ascending: false }).limit(50),
    supabase.from("site_transfers").select("*, work_orders(order_number)").order("created_at", { ascending: false }).limit(20),
    supabase.from("v_stock_status").select("*").eq("low_stock", true)
  ]);

  return (
    <AdminShell pageTitle="Incidents" pageHint="Étapes en retard, alertes stock bas et statut des transferts.">
      <IncidentsClient overdue={overdue ?? []} transfers={transfers ?? []} lowStock={(lowStock ?? []) as any[]} />
    </AdminShell>
  );
}
