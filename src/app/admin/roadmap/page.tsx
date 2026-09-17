import { createServerSupabase } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import RoadmapClient from "./RoadmapClient";
import { getProfil } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function RoadmapPage() {
  const profil = await getProfil();
  const usine = profil?.usine_code ?? "ADMEDCO";
  const supabase: any = createServerSupabase();

  // Commandes scopées usine (fallback sans usine_code)
  let orders: any[] = [];
  try {
    const { data } = await supabase
      .from("work_orders")
      .select("id,order_number,status,created_at,usine_code")
      .eq("usine_code", usine)
      .order("created_at", { ascending: false })
      .limit(50);
    orders = (data as any[]) ?? [];
  } catch {
    const { data } = await supabase.from("work_orders").select("id,order_number,status,created_at").order("created_at", { ascending: false }).limit(50);
    orders = (data as any[]) ?? [];
  }
  const orderIds = orders.map((o) => o.id);

  let items: any[] = [];
  let steps: any[] = [];
  let semi: any[] = [];
  let destinations: any[] = [];
  let transfers: any[] = [];
  if (orderIds.length > 0) {
    try {
      const { data } = await supabase.from("work_order_items").select("id,order_id,product_name,quantity,status").in("order_id", orderIds);
      items = (data as any[]) ?? [];
    } catch { items = []; }
    const itemIds = items.map((i) => i.id);
    if (itemIds.length > 0) {
      try {
        const { data } = await supabase.from("work_order_steps").select("id,item_id,step_order,atelier_id,step_name,status").in("item_id", itemIds).order("step_order");
        steps = (data as any[]) ?? [];
      } catch { steps = []; }
      try {
        const { data } = await supabase.from("semi_finished_stock").select("id,item_id,quantity,status,created_at").in("item_id", itemIds);
        semi = (data as any[]) ?? [];
      } catch { semi = []; }
      try {
        const { data } = await supabase.from("destinations").select("id,semi_stock_id,order_item_id,destination,bordereau,statut,created_at").in("order_item_id", itemIds);
        destinations = (data as any[]) ?? [];
      } catch { destinations = []; }
    }
    try {
      const { data } = await supabase.from("site_transfers").select("id,order_id,order_item_id,destination,manifest_qr,status,created_at").in("order_id", orderIds).order("created_at", { ascending: false }).limit(50);
      transfers = (data as any[]) ?? [];
    } catch { transfers = []; }
  }

  return (
    <AdminShell pageTitle="Feuille de route" pageHint={`Parcours temps réel des commandes — usine ${usine}. Commande → Réservé → Production → Stock → Destination.`}>
      <RoadmapClient usine={usine} orders={orders} items={items} steps={steps} semi={semi} destinations={destinations} transfers={transfers} />
    </AdminShell>
  );
}
