import { createServerSupabase } from "@/lib/supabase/server";
import CreateOrderDialog from "@/components/admin/CreateOrderDialog";
import DashboardLive from "./DashboardLive";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createServerSupabase();
  const { data: orders } = await supabase.from("work_orders").select("*, product_categories(name)").order("created_at", { ascending: false }).limit(50);
  const { data: categories } = await supabase.from("product_categories").select("id,name");
  const { data: transfers } = await supabase.from("site_transfers").select("*, work_orders(order_number)").order("id", { ascending: false }).limit(20);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-black">📊 Live Production Pipeline</h1>
        <CreateOrderDialog categories={categories ?? []} />
      </div>
      <DashboardLive orders={orders ?? []} />
      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
        <h2 className="font-black text-lg mb-2">🚚 Inter-site transfers (Site A → Site B)</h2>
        <div className="space-y-1 text-sm">
          {(transfers ?? []).map((t: any) => (
            <div key={t.id} className="flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2">
              <span className="font-mono text-yellow-300">{t.manifest_qr}</span>
              <span>{t.work_orders?.order_number} · A{t.from_atelier}→A{t.to_atelier} · ×{t.item_count}</span>
              <span className={`ml-auto rounded px-2 py-0.5 font-bold ${t.status === "VERIFIED" ? "bg-emerald-600" : t.status === "SHORTAGE" ? "bg-red-600" : "bg-amber-600 text-black"}`}>{t.status}</span>
            </div>
          ))}
          {(transfers ?? []).length === 0 && <p className="text-zinc-500">No transfers yet.</p>}
        </div>
      </div>
    </div>
  );
}
