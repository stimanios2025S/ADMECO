import { createServerSupabase } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import LivePipeline from "@/components/admin/LivePipeline";
import GanttBoard from "@/components/admin/GanttBoard";
import { GlassCard, SectionTitle } from "@/components/admin/ui";
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

  if (!order) {
    return (
      <AdminShell pageTitle="Order not found" pageHint="This order may have been deleted.">
        <p className="text-zinc-400">Order not found.</p>
      </AdminShell>
    );
  }
  const done = (steps ?? []).filter((s: any) => s.status === "DONE").length;

  return (
    <AdminShell
      pageTitle={order.order_number}
      pageHint={`${order.product_categories?.name} · target ×${order.target_quantity} · ${done}/${steps?.length ?? 0} steps · ${order.status}`}
    >
      <div className="stagger space-y-5">
        <OrderLiveRefresh orderId={params.id} />
        <div className="flex justify-end"><OrderActions orderId={params.id} /></div>
        <div className="grid gap-5 lg:grid-cols-2">
          <GlassCard>
            <SectionTitle kicker="Kanban" title="Live pipeline" hint="Real-time step states." />
            <LivePipeline steps={(steps ?? []) as any} />
          </GlassCard>
          <GlassCard>
            <SectionTitle kicker="Gantt" title="Time variance" hint="Actual vs target per step." />
            <GanttBoard steps={(steps ?? []) as any} />
          </GlassCard>
        </div>
        {(transfers ?? []).map((t: any) => (
          <ManifestQrCard key={t.id} manifest={t.manifest_qr} orderNumber={order.order_number} itemCount={t.item_count} />
        ))}
        <GlassCard>
          <SectionTitle kicker="Print" title="Step QR labels" hint="Printable sheet for the floor." />
          <QrLabelSheet labels={(steps ?? []).map((s: any) => ({ orderNumber: order.order_number, stepOrder: s.step_order, stepName: s.step_name, hash: s.qr_code_hash }))} />
        </GlassCard>
      </div>
    </AdminShell>
  );
}
