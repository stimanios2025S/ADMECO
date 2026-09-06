import { createServerSupabase } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import AnalyticsClient from "./AnalyticsClient";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const supabase = createServerSupabase();
  const [{ data: steps }, { data: orders }, { data: logs }] = await Promise.all([
    supabase.from("work_order_steps").select("*, work_orders!inner(order_number, product_categories(name))").limit(3000),
    supabase.from("work_orders").select("*, product_categories(name)").limit(200),
    supabase.from("material_logs").select("material_name,quantity_used,quantity_lost").limit(3000)
  ]);

  return (
    <AdminShell pageTitle="Analytics" pageHint="Whole-platform intelligence — yield, time, materials, sites.">
      <AnalyticsClient steps={steps ?? []} orders={orders ?? []} logs={logs ?? []} />
    </AdminShell>
  );
}
