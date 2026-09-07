import { createServerSupabase } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import AnalyticsClient from "./AnalyticsClient";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const supabase = createServerSupabase();
  const [{ data: items }, { data: logs }, { data: steps }, { data: orders }] = await Promise.all([
    supabase.from("work_order_items").select("id,product_name,quantity,status,product_categories(name)").limit(200),
    supabase.from("material_logs").select("*, stock_items(name,unit)").limit(3000),
    supabase.from("work_order_steps").select("step_name,atelier_id,status,actual_minutes,estimated_minutes").limit(3000),
    supabase.from("work_orders").select("id,order_number,status,created_at").limit(100)
  ]);

  return (
    <AdminShell pageTitle="Analytics" pageHint="Whole-platform intelligence — yield, time, materials, sites.">
      <AnalyticsClient items={(items ?? []) as any[]} logs={(logs ?? []) as any[]} steps={(steps ?? []) as any[]} orders={(orders ?? []) as any[]} />
    </AdminShell>
  );
}
