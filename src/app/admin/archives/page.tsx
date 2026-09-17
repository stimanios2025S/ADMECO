import { createServerSupabase } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import ArchivesClient from "./ArchivesClient";
import { getProfil } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ArchivesPage() {
  const profil = await getProfil();
  const usine = profil?.usine_code ?? "ADMEDCO";
  const supabase: any = createServerSupabase();

  // Commandes scopées usine
  let orders: any[] = [];
  try {
    const { data } = await supabase
      .from("work_orders")
      .select("id,order_number,status,created_at,usine_code,due_at")
      .eq("usine_code", usine)
      .order("created_at", { ascending: false })
      .limit(100);
    orders = (data as any[]) ?? [];
  } catch {
    const { data } = await supabase.from("work_orders").select("id,order_number,status,created_at,due_at").order("created_at", { ascending: false }).limit(100);
    orders = (data as any[]) ?? [];
  }
  const orderIds = orders.map((o) => o.id);

  let items: any[] = [];
  let steps: any[] = [];
  let reservations: any[] = [];
  let materialLogs: any[] = [];
  let movements: any[] = [];
  let transfers: any[] = [];
  let destinations: any[] = [];
  let receptions: any[] = [];

  if (orderIds.length > 0) {
    try {
      const { data } = await supabase.from("work_order_items").select("id,order_id,product_name,quantity,status").in("order_id", orderIds);
      items = (data as any[]) ?? [];
    } catch { items = []; }
    const itemIds = items.map((i) => i.id);
    if (itemIds.length > 0) {
      try {
        const { data } = await supabase.from("work_order_steps").select("id,item_id,step_order,atelier_id,step_name,status,quantity_ok").in("item_id", itemIds).order("step_order");
        steps = (data as any[]) ?? [];
      } catch { steps = []; }
      try {
        const { data } = await supabase.from("order_item_reservations").select("id,order_item_id,estimated_qty,consumed_qty,stock_items(name,unit)").in("order_item_id", itemIds).limit(500);
        reservations = (data as any[]) ?? [];
      } catch { reservations = []; }
      const stepIds = steps.map((s) => s.id);
      if (stepIds.length > 0) {
        try {
          const { data } = await supabase.from("material_logs").select("id,step_id,stock_item_id,quantity_used,quantity_lost,quantity_ok,stock_items(name,unit)").in("step_id", stepIds).limit(500);
          materialLogs = (data as any[]) ?? [];
        } catch { materialLogs = []; }
      }
      try {
        const { data } = await supabase.from("destinations").select("id,order_item_id,semi_stock_id,destination,bordereau,statut,created_at").in("order_item_id", itemIds).limit(200);
        destinations = (data as any[]) ?? [];
      } catch { destinations = []; }
      try {
        const { data } = await supabase.from("site_transfers").select("id,order_id,order_item_id,destination,manifest_qr,status,created_at").in("order_id", orderIds).limit(200);
        transfers = (data as any[]) ?? [];
      } catch { transfers = []; }
    }
  }

  // Mouvements stock de l'usine (via usine_code, fallback global limité)
  try {
    const { data } = await supabase.from("stock_movements").select("id,stock_item_id,order_item_id,movement_type,quantity,note,created_at,stock_items(name,unit)").order("created_at", { ascending: false }).limit(200);
    movements = (data as any[]) ?? [];
  } catch { movements = []; }

  // Réceptions MP de l'usine
  try {
    const { data } = await supabase.from("receptions_mp").select("id,usine_code,numero_facture,lignes,statut,created_at,fournisseurs(nom)").eq("usine_code", usine).order("created_at", { ascending: false }).limit(50);
    receptions = (data as any[]) ?? [];
  } catch { receptions = []; }

  // Dossiers par commande
  const dossiers = orders.map((o: any) => {
    const oItems = items.filter((i) => i.order_id === o.id);
    const oItemIds = new Set(oItems.map((i) => i.id));
    const oSteps = steps.filter((s) => oItemIds.has(s.item_id));
    const oRes = reservations.filter((r) => oItemIds.has(r.order_item_id));
    const oStepIds = new Set(oSteps.map((s) => s.id));
    const oLogs = materialLogs.filter((l) => oStepIds.has(l.step_id));
    const oDest = destinations.filter((d) => oItemIds.has(d.order_item_id));
    const oTrans = transfers.filter((t) => t.order_id === o.id || oItemIds.has(t.order_item_id));
    const oMoves = movements.filter((m) => oItemIds.has(m.order_item_id));
    return {
      order: o,
      items: oItems,
      steps: oSteps,
      reservations: oRes,
      logs: oLogs,
      destinations: oDest,
      transfers: oTrans,
      movements: oMoves
    };
  });

  return (
    <AdminShell pageTitle="Archives" pageHint={`Dossiers complets par commande — usine ${usine} : articles, réserves, ateliers, stocks, bordereaux.`}>
      <ArchivesClient usine={usine} dossiers={dossiers} receptions={receptions} />
    </AdminShell>
  );
}
