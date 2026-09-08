import { createServerSupabase } from "@/lib/supabase/server";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import { GlassCard, SectionTitle, StatusPill, Empty } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

function LoadError({ message }: { message: string }) {
  return (
    <div className="card space-y-2 border-red-200 p-6">
      <p className="font-black text-[#1a1d23]">Couldn't load orders</p>
      <p className="rounded-xl bg-red-50 px-3 py-2 font-mono text-xs text-red-500">{message}</p>
      <p className="text-sm text-[#7c8091]">
        Check: Supabase project active (not paused)? Migrations <b>0005 → 0006 → 0007</b> run in order?
        Vercel Production env has <span className="font-mono">NEXT_PUBLIC_SUPABASE_URL</span> +{" "}
        <span className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>?
      </p>
    </div>
  );
}

export default async function OrdersPage() {
  try {
    const supabase = createServerSupabase();
    const { data: orders, error } = await supabase.from("work_orders").select("*, work_order_items(id,product_name,quantity,status)").order("created_at", { ascending: false }).limit(50);
    if (error) throw new Error("work_orders: " + error.message);

    return (
      <AdminShell pageTitle="Orders" pageHint="All production orders — create, track and release to MOBILIX.">
        <div className="stagger space-y-5">
          <div className="flex justify-end">
            <Link href="/admin/orders/new" className="btn-fire inline-flex items-center gap-1.5 px-5 py-2.5 text-sm">+ New order</Link>
          </div>
          {!orders || orders.length === 0 ? (
            <Empty icon="📦" title="No orders yet" hint="Create your first production order." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {orders.map((o: any) => (
                <Link key={o.id} href={`/admin/orders/${o.id}`} className="card group p-4 transition hover:border-[#4a7c59]/30">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-lg">{o.order_number}</span>
                    <StatusPill status={o.status} />
                  </div>
                  <p className="mt-1 text-xs text-[#7c8091]">
                    {o.work_order_items?.length ?? 0} items · {new Date(o.created_at).toLocaleDateString("fr-FR")}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(o.work_order_items ?? []).slice(0, 3).map((item: any) => (
                      <span key={item.id} className="rounded-md bg-[#f0ede8] px-2 py-0.5 text-[10px] font-bold text-[#7c8091]">
                        {item.product_name} ×{item.quantity}
                      </span>
                    ))}
                    {(o.work_order_items?.length ?? 0) > 3 && (
                      <span className="rounded-md bg-[#f0ede8] px-2 py-0.5 text-[10px] text-[#7c8091]">+{(o.work_order_items?.length ?? 0) - 3} more</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </AdminShell>
    );
  } catch (e: any) {
    console.error("[OrdersPage]", e);
    return (
      <AdminShell pageTitle="Orders" pageHint="All production orders — create, track and release to MOBILIX.">
        <LoadError message={e?.message ?? String(e)} />
      </AdminShell>
    );
  }
}
