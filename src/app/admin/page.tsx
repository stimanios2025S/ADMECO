import { createServerSupabase } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const supabase = createServerSupabase();

  const [{ data: orders }, { data: items }, { data: stocks }, { data: semiStock }, { data: transfers }, { data: badSteps }] =
    await Promise.all([
      supabase.from("work_orders").select("id,order_number,status,created_at"),
      supabase.from("work_order_items").select("id,status,steps_completed,steps_total"),
      supabase.from("v_stock_status").select("*"),
      supabase.from("semi_finished_stock").select("id,status"),
      supabase.from("site_transfers").select("*").order("created_at", { ascending: false }).limit(10),
      supabase.from("v_step_variance").select("*").gt("variance_min", 0).neq("status", "PENDING").limit(10)
    ]);

  const kpi = {
    activeOrders: (orders ?? []).filter((o: any) => !["RELEASED", "CANCELLED"].includes(o.status)).length,
    totalItems: (items ?? []).length,
    readyItems: (items ?? []).filter((i: any) => i.status === "SEMI_READY").length,
    lowStock: (stocks ?? []).filter((s: any) => s.low_stock).length,
    pendingSemi: (semiStock ?? []).filter((s: any) => s.status === "PENDING").length,
    overdueSteps: (badSteps ?? []).length,
    transfers: (transfers ?? []).length,
    totalStock: (stocks ?? []).length
  };

  return (
    <AdminShell pageTitle="Dashboard" pageHint="Command center ADEMCO — production, stock, transferts.">
      <DashboardClient kpi={kpi} orders={orders ?? []} stocks={(stocks ?? []) as any[]} transfers={transfers ?? []} />
    </AdminShell>
  );
}
