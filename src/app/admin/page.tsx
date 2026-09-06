import { createServerSupabase } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const supabase = createServerSupabase();

  const [{ data: orders }, { data: steps }, { data: transfers }, { data: categories }, { data: badSteps }] =
    await Promise.all([
      supabase.from("work_orders").select("*, product_categories(name)").order("created_at", { ascending: false }).limit(50),
      supabase.from("work_order_steps").select("id,work_order_id,status,atelier_id,estimated_minutes,actual_minutes,good_units,scrap_units,expected_units").limit(2000),
      supabase.from("site_transfers").select("*, work_orders(order_number)").order("id", { ascending: false }).limit(10),
      supabase.from("product_categories").select("id,name"),
      supabase.from("v_step_variance").select("*").gt("scrap_pct", 5).order("scrap_pct", { ascending: false }).limit(8)
    ]);

  const s = steps ?? [];
  const kpi = {
    activeOrders: (orders ?? []).filter((o: any) => !["COMPLETED"].includes(o.status)).length,
    totalOrders: (orders ?? []).length,
    stepsDone: s.filter((x: any) => x.status === "DONE").length,
    stepsTotal: s.length,
    overdue: s.filter((x: any) => Number(x.actual_minutes) > Number(x.estimated_minutes) && x.status !== "PENDING").length,
    scrapAlerts: (badSteps ?? []).length,
    inTransit: (transfers ?? []).filter((t: any) => t.status === "IN_TRANSIT").length
  };

  return (
    <AdminShell pageTitle="Dashboard" pageHint="Live command center — every atelier, every order, right now.">
      <DashboardClient
        kpi={kpi}
        orders={orders ?? []}
        categories={categories ?? []}
        transfers={transfers ?? []}
        badSteps={badSteps ?? []}
      />
    </AdminShell>
  );
}
