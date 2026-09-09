import { createServerSupabase } from "@/lib/supabase/server";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import { GlassCard, SectionTitle, StatusPill, Empty } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

function LoadError({ message }: { message: string }) {
  return (
    <div className="card space-y-2 border-red-200 p-6">
      <p className="font-black text-[#1a1d23]">Chargement des commandes impossible</p>
      <p className="rounded-xl bg-red-50 px-3 py-2 font-mono text-xs text-red-500">{message}</p>
      <p className="text-sm text-[#7c8091]">
        Vérifiez : projet Supabase actif (non en pause) ? Migrations <b>0005 → 0006 → 0007 → 0008</b> exécutées dans l'ordre ?
        Variables Vercel Production <span className="font-mono">NEXT_PUBLIC_SUPABASE_URL</span> +{" "}
        <span className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</span> présentes ?
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
      <AdminShell pageTitle="Commandes" pageHint="Toutes les commandes — créer, suivre et libérer vers l'Atelier 2.">
        <div className="stagger space-y-5">
          <div className="flex justify-end">
            <Link href="/admin/orders/new" className="btn-fire inline-flex items-center gap-1.5 px-5 py-2.5 text-sm">+ Nouvelle commande</Link>
          </div>
          {!orders || orders.length === 0 ? (
            <Empty icon="📦" title="Aucune commande" hint="Créez votre première commande de production." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {orders.map((o: any) => (
                <Link key={o.id} href={`/admin/orders/${o.id}`} className="card group p-4 transition hover:border-[#4a7c59]/30">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-lg">{o.order_number}</span>
                    <StatusPill status={o.status} />
                  </div>
                  <p className="mt-1 text-xs text-[#7c8091]">
                    {o.work_order_items?.length ?? 0} articles · {new Date(o.created_at).toLocaleDateString("fr-FR")}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(o.work_order_items ?? []).slice(0, 3).map((item: any) => (
                      <span key={item.id} className="rounded-md bg-[#f0ede8] px-2 py-0.5 text-[10px] font-bold text-[#7c8091]">
                        {item.product_name} ×{item.quantity}
                      </span>
                    ))}
                    {(o.work_order_items?.length ?? 0) > 3 && (
                      <span className="rounded-md bg-[#f0ede8] px-2 py-0.5 text-[10px] text-[#7c8091]">+{(o.work_order_items?.length ?? 0) - 3} autres</span>
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
      <AdminShell pageTitle="Commandes" pageHint="Toutes les commandes — créer, suivre et libérer vers l'Atelier 2.">
        <LoadError message={e?.message ?? String(e)} />
      </AdminShell>
    );
  }
}
