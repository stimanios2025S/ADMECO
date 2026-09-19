import { createServerSupabase } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import SuiviA1Client from "./SuiviA1Client";
import { getProfil } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Suivi de production Atelier 01 ADMEDCO — Gamme ECO : 6 postes + stock produit fini.
export default async function SuiviA1Page() {
  const profil = await getProfil();
  const supabase: any = createServerSupabase();

  // Commandes ECO (scopé usine ADMEDCO, repli : toutes si colonne absente)
  let orders: any[] = [];
  try {
    try {
      const { data } = await supabase.from("work_orders").select("id,order_number,status,created_at,due_at,priority,product_line").eq("usine_code", "ADMEDCO").order("priority").order("created_at", { ascending: false }).limit(50);
      orders = ((data as any[]) ?? []).filter((o: any) => /eco/i.test(o.product_line ?? ""));
    } catch {
      const { data } = await supabase.from("work_orders").select("id,order_number,status,created_at,due_at,priority,product_line").order("created_at", { ascending: false }).limit(50);
      orders = ((data as any[]) ?? []).filter((o: any) => /eco/i.test(o.product_line ?? "") || /ecoo|suivi eco/i.test((o as any).design_notes ?? ""));
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
      items = ((data as any[]) ?? []).filter((i: any) => /ecoo|suivi eco|stock produit fini/i.test(i.design_notes ?? ""));
    } catch { items = []; }
    const itemIds = items.map((i: any) => i.id);
    if (itemIds.length > 0) {
      try {
        const { data } = await supabase.from("work_order_steps").select("id,item_id,step_order,step_name,atelier_id,status,quantity_ok,target_qty,started_at,completed_at").in("item_id", itemIds).eq("atelier_id", 1).order("step_order").limit(3000);
        steps = (data as any[]) ?? [];
      } catch {
        try {
          const { data } = await supabase.from("work_order_steps").select("id,item_id,step_order,step_name,atelier_id,status,quantity_ok,started_at,completed_at").in("item_id", itemIds).eq("atelier_id", 1).order("step_order").limit(3000);
          steps = (data as any[]) ?? [];
        } catch { steps = []; }
      }
    }
  }

  return (
    <AdminShell
      pageTitle="Suivi Atelier 01"
      pageHint="Gamme Tôle — 6 postes : Réception MP → Coupe & débit → Perçage → Soudage → Cache-jupe → Contrôle → Transfert vers l'Atelier 3 (poudrage)."
    >
      <SuiviA1Client
        usine={profil?.usine_code ?? "ADMEDCO"}
        orders={orders}
        items={items}
        steps={steps}
      />
    </AdminShell>
  );
}
