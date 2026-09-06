import { createServerSupabase } from "@/lib/supabase/server";
import LivePipeline from "@/components/admin/LivePipeline";
import GanttBoard from "@/components/admin/GanttBoard";
import QrLabelSheet from "@/components/qr/QrLabelSheet";
import ManifestQrCard from "@/components/qr/ManifestQrCard";
import OrderActions from "./OrderActions";
import OrderLiveRefresh from "./OrderLiveRefresh";

export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: order } = await supabase.from("work_orders").select("*, product_categories(name)").eq("id", params.id).single();
  const { data: steps } = await supabase.from("work_order_steps").select("*").eq("work_order_id", params.id).order("step_order");
  const { data: transfers } = await supabase.from("site_transfers").select("*").eq("work_order_id", params.id);

  if (!order) return <p>Order not found.</p>;
  const done = (steps ?? []).filter((s: any) => s.status === "DONE").length;

  return (
    <div className="space-y-6">
      <OrderLiveRefresh orderId={params.id} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">{order.order_number}</h1>
          <p className="text-zinc-400">{order.product_categories?.name} · target ×{order.target_quantity} · {done}/{steps?.length ?? 0} steps done · <b>{order.status}</b></p>
        </div>
        <OrderActions orderId={params.id} />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-zinc-950 border border-zinc-800 p-4">
          <h2 className="font-black mb-2">🔴 Live pipeline (Kanban)</h2>
          <LivePipeline steps={(steps ?? []) as any} />
        </div>
        <div className="rounded-2xl bg-zinc-950 border border-zinc-800 p-4">
          <h2 className="font-black mb-2">📅 Time variance (Gantt: actual vs target)</h2>
          <GanttBoard steps={(steps ?? []) as any} />
        </div>
      </div>
      {(transfers ?? []).map((t: any) => (
        <ManifestQrCard key={t.id} manifest={t.manifest_qr} orderNumber={order.order_number} itemCount={t.item_count} />
      ))}
      <div className="rounded-2xl bg-zinc-950 border border-zinc-800 p-4">
        <h2 className="font-black mb-2">🏷️ Step QR labels (printable)</h2>
        <QrLabelSheet labels={(steps ?? []).map((s: any) => ({ orderNumber: order.order_number, stepOrder: s.step_order, stepName: s.step_name, hash: s.qr_code_hash }))} />
      </div>
    </div>
  );
}
