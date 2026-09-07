import { createServerSupabase } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import { GlassCard, SectionTitle, StatusPill } from "@/components/admin/ui";
import OrderDetailClient from "./OrderDetailClient";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const [{ data: order }, { data: items }, { data: transfers }] = await Promise.all([
    supabase.from("work_orders").select("*").eq("id", params.id).single(),
    supabase.from("work_order_items").select("*, product_categories(name)").eq("order_id", params.id),
    supabase.from("site_transfers").select("*").eq("order_id", params.id)
  ]);

  if (!order) return <AdminShell pageTitle="Order not found" pageHint=""><p>Not found.</p></AdminShell>;

  // Get steps per item
  const itemIds = (items ?? []).map((i: any) => i.id);
  const { data: allSteps } = itemIds.length > 0
    ? await supabase.from("work_order_steps").select("*").in("item_id", itemIds).order("step_order")
    : { data: [] };

  // Group steps by item (plain object — Maps can't cross to Client Components)
  const stepsByItem: Record<string, any[]> = {};
  for (const s of allSteps ?? []) {
    (stepsByItem[s.item_id] ??= []).push(s);
  }

  const readyCount = (items ?? []).filter((i: any) => i.status === "SEMI_READY").length;

  return (
    <AdminShell pageTitle={order.order_number}
      pageHint={`${(items ?? []).length} items · ${readyCount} ready · ${order.status}`}>
      <div className="stagger space-y-5">
        {order.due_at && <p className="text-sm text-zinc-400">Due: {new Date(order.due_at).toLocaleDateString("fr-FR")}</p>}
        <OrderDetailClient orderId={order.id} orderStatus={order.status} items={(items ?? []) as any[]} stepsByItem={stepsByItem} transfers={(transfers ?? []) as any[]} />
      </div>
    </AdminShell>
  );
}
