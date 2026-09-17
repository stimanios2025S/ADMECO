import { createServerSupabase } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import SuiviMobilixClient from "./SuiviMobilixClient";
import { getProfil } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Suivi de production MOBILIX (G21 + CANADA) — 12 postes / 19 QR par chaise.
export default async function SuiviMobilixPage() {
  const profil = await getProfil();
  const supabase: any = createServerSupabase();

  // Commandes MOBILIX (scopé usine, repli : toutes si colonne absente)
  let orders: any[] = [];
  try {
    let q: any = supabase.from("work_orders").select("id,order_number,status,created_at,due_at");
    try {
      const { data } = await q.eq("usine_code", "MOBILIX").order("created_at", { ascending: false }).limit(50);
      orders = (data as any[]) ?? [];
    } catch {
      const { data } = await supabase.from("work_orders").select("id,order_number,status,created_at,due_at").order("created_at", { ascending: false }).limit(50);
      orders = (data as any[]) ?? [];
    }
  } catch {
    orders = [];
  }

  const orderIds = orders.map((o: any) => o.id);
  let items: any[] = [];
  let steps: any[] = [];
  if (orderIds.length > 0) {
    try {
      const { data } = await supabase.from("work_order_items").select("id,order_id,product_name,quantity,status,design_notes").in("order_id", orderIds).limit(200);
      items = (data as any[]) ?? [];
    } catch { items = []; }
    const itemIds = items.map((i: any) => i.id);
    if (itemIds.length > 0) {
      try {
        const { data } = await supabase.from("work_order_steps").select("id,item_id,step_order,step_name,atelier_id,status,quantity_ok,started_at,completed_at").in("item_id", itemIds).eq("atelier_id", 3).order("step_order").limit(2000);
        steps = (data as any[]) ?? [];
      } catch { steps = []; }
    }
  }

  return (
    <AdminShell
      pageTitle="Suivi MOBILIX"
      pageHint="Production G21 & CANADA — 12 postes, couture A→H en 8 QR, 19 QR par chaise."
    >
      <SuiviMobilixClient
        usine={profil?.usine_code ?? "ADMEDCO"}
        orders={orders}
        items={items}
        steps={steps}
      />
    </AdminShell>
  );
}
