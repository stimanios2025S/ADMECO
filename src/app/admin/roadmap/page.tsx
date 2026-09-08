import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import RoadmapClient from "./RoadmapClient";

export const dynamic = "force-dynamic";

export default async function RoadmapPage({ searchParams }: { searchParams: { order?: string } }) {
  const supabase = createServerSupabase();
  const { data: orders } = await supabase.from("work_orders").select("*, work_order_items(id,product_name,quantity,status)").order("created_at", { ascending: false }).limit(50);
  const { data: transfers } = await supabase.from("site_transfers").select("*, work_orders(order_number)").order("created_at", { ascending: false }).limit(30);

  const selectedId = searchParams.order ?? (orders?.[0] as any)?.id ?? null;
  let steps: any[] = [];
  if (selectedId) {
    const { data: items } = await supabase.from("work_order_items").select("id").eq("order_id", selectedId);
    const ids = (items ?? []).map((i: any) => i.id);
    if (ids.length > 0) {
      const { data } = await supabase.from("work_order_steps").select("*").in("item_id", ids).order("step_order");
      steps = data ?? [];
    }
  }

  return (
    <AdminShell pageTitle="Roadmap" pageHint="Every order's journey through Zone A ateliers to Site B finishing.">
      {(!orders || orders.length === 0) ? (
        <div className="card p-10 text-center">
          <div className="text-4xl">🗺️</div>
          <p className="mt-2 font-bold">No orders to map yet</p>
          <p className="text-sm text-[#7c8091]">Create an order from the Dashboard to see its roadmap here.</p>
          <Link href="/admin" className="btn-fire mt-4 inline-block px-5 py-2 text-sm">Go to Dashboard</Link>
        </div>
      ) : (
        <RoadmapClient orders={orders ?? []} steps={steps} transfers={transfers ?? []} selectedId={selectedId} />
      )}
    </AdminShell>
  );
}
