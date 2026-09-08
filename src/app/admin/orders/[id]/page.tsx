import { createServerSupabase } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import OrderDetailClient from "./OrderDetailClient";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  try {
    const supabase = createServerSupabase();
    const [{ data: order, error: eo }, { data: items, error: ei }, { data: transfers, error: et }] = await Promise.all([
      supabase.from("work_orders").select("*").eq("id", params.id).single(),
      supabase.from("work_order_items").select("*, product_categories(name)").eq("order_id", params.id),
      supabase.from("site_transfers").select("*").eq("order_id", params.id)
    ]);
    if (eo) throw new Error("work_orders: " + eo.message);
    if (ei) throw new Error("work_order_items: " + ei.message);
    if (et) throw new Error("site_transfers: " + et.message);

    if (!order) return <AdminShell pageTitle="Order not found" pageHint=""><p>Not found.</p></AdminShell>;

    // Get steps per item
    const itemIds = (items ?? []).map((i: any) => i.id);
    const { data: allSteps, error: es } = itemIds.length > 0
      ? await supabase.from("work_order_steps").select("*").in("item_id", itemIds).order("step_order")
      : { data: [], error: null };
    if (es) throw new Error("work_order_steps: " + es.message);

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
          {order.due_at && <p className="text-sm text-[#7c8091]">Due: {new Date(order.due_at).toLocaleDateString("fr-FR")}</p>}
          <OrderDetailClient orderId={order.id} orderStatus={order.status} items={(items ?? []) as any[]} stepsByItem={stepsByItem} transfers={(transfers ?? []) as any[]} />
        </div>
      </AdminShell>
    );
  } catch (e: any) {
    console.error("[OrderDetailPage]", e);
    return (
      <AdminShell pageTitle="Order" pageHint="">
        <div className="card space-y-2 border-red-200 p-6">
          <p className="font-black text-[#1a1d23]">Couldn't load this order</p>
          <p className="rounded-xl bg-red-50 px-3 py-2 font-mono text-xs text-red-500">{e?.message ?? String(e)}</p>
        </div>
      </AdminShell>
    );
  }
}
