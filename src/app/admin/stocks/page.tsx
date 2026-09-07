import { createServerSupabase } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import StocksClient from "./StocksClient";

export const dynamic = "force-dynamic";

export default async function StocksPage() {
  const supabase = createServerSupabase();
  const [{ data: stocks }, { data: movements }] = await Promise.all([
    supabase.from("v_stock_status").select("*").order("name"),
    supabase.from("stock_movements").select("*, stock_items(name,unit)").order("created_at", { ascending: false }).limit(50)
  ]);
  const [{ data: reservations }, { data: semiStock }] = await Promise.all([
    supabase.from("order_item_reservations").select("*, stock_items(name,unit)").limit(200),
    supabase.from("semi_finished_stock").select("*, work_order_items(product_name,quantity)").order("created_at", { ascending: false }).limit(50)
  ]);

  return (
    <AdminShell pageTitle="Stocks" pageHint="Inventaire ADEMCO — matières premières, réservations, produits semi-finis.">
      <StocksClient
        stocks={(stocks ?? []) as any[]}
        movements={(movements ?? []) as any[]}
        reservations={(reservations ?? []) as any[]}
        semiStock={(semiStock ?? []) as any[]}
      />
    </AdminShell>
  );
}
