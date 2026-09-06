import { createServerSupabase } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import IncidentsClient from "./IncidentsClient";

export const dynamic = "force-dynamic";

export default async function IncidentsPage() {
  const supabase = createServerSupabase();
  // NOTE: v_step_variance is a view (no FK metadata for PostgREST embeds),
  // so we fetch variance rows + orders separately and join in code.
  const [{ data: scrap }, { data: overdue }, { data: shortages }, { data: orders }] = await Promise.all([
    supabase.from("v_step_variance").select("*").gt("scrap_pct", 5).order("scrap_pct", { ascending: false }).limit(50),
    supabase.from("v_step_variance").select("*").gt("variance_min", 0).neq("status", "PENDING").order("variance_min", { ascending: false }).limit(50),
    supabase.from("site_transfers").select("*, work_orders(order_number)").eq("status", "SHORTAGE").order("id", { ascending: false }).limit(20),
    supabase.from("work_orders").select("id,order_number").limit(500)
  ]);

  const orderNo = new Map((orders ?? []).map((o: any) => [o.id, o.order_number]));
  const withNo = (rows: any[]) => (rows ?? []).map((r) => ({ ...r, work_orders: { order_number: orderNo.get(r.work_order_id) ?? "—" } }));

  return (
    <AdminShell pageTitle="Incidents" pageHint="Scrap overruns, overdue steps and transfer shortages — act before they cascade.">
      <IncidentsClient scrap={withNo(scrap ?? [])} overdue={withNo(overdue ?? [])} shortages={shortages ?? []} />
    </AdminShell>
  );
}
