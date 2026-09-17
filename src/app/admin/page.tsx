import { createServerSupabase } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import DashboardClient from "./DashboardClient";
import { getProfil, depotsUsine } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const profil = await getProfil();
  const usine = profil?.usine_code ?? "ADMEDCO";
  const nomUsine = usine === "MOBILIX" ? "MOBILIX" : "ADMEDCO";
  const depots = depotsUsine(usine);
  const supabase: any = createServerSupabase();

  // Commandes de l'usine
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

  // Articles des commandes de l'usine
  let items: any[] = [];
  if (orderIds.length > 0) {
    try {
      const { data } = await supabase
        .from("work_order_items")
        .select("id,order_id,status,steps_completed,steps_total")
        .in("order_id", orderIds);
      items = (data as any[]) ?? [];
    } catch {
      items = [];
    }
  } else {
    try {
      const { data } = await supabase.from("work_order_items").select("id,status,steps_completed,steps_total");
      items = (data as any[]) ?? [];
    } catch {
      items = [];
    }
  }

  // Stocks de l'usine (usine_code ou dépôts)
  let stocks: any[] = [];
  try {
    const { data } = await supabase.from("v_stock_status").select("*").in("depot_code", depots);
    stocks = (data as any[]) ?? [];
  } catch {
    try {
      const { data } = await supabase.from("v_stock_status").select("*");
      stocks = (data as any[]) ?? [];
    } catch {
      stocks = [];
    }
  }

  // Transferts de l'usine
  let transfers: any[] = [];
  try {
    const { data } = await supabase
      .from("site_transfers")
      .select("*")
      .eq("usine_code", usine)
      .order("created_at", { ascending: false })
      .limit(10);
    transfers = (data as any[]) ?? [];
  } catch {
    try {
      const { data } = await supabase.from("site_transfers").select("*").order("created_at", { ascending: false }).limit(10);
      transfers = (data as any[]) ?? [];
    } catch {
      transfers = [];
    }
  }

  // Alertes non lues de l'usine
  let alertes: any[] = [];
  try {
    const { data } = await supabase
      .from("alertes")
      .select("*")
      .eq("usine_code", usine)
      .eq("lu", false)
      .order("created_at", { ascending: false })
      .limit(20);
    alertes = (data as any[]) ?? [];
  } catch {
    alertes = [];
  }

  // Réservations actives (articles de l'usine)
  let reservations: any[] = [];
  try {
    const itemIds = items.map((i) => i.id);
    if (itemIds.length > 0) {
      const { data } = await supabase
        .from("order_item_reservations")
        .select("id,order_item_id,stock_item_id,estimated_qty,consumed_qty,created_at,stock_items(id,name,unit,quantity)")
        .in("order_item_id", itemIds)
        .limit(200);
      reservations = (data as any[]) ?? [];
    }
  } catch {
    reservations = [];
  }

  // Semi-fini en attente (pour la carte destinations)
  let semiPending = 0;
  try {
    const { data: semi } = await supabase.from("semi_finished_stock").select("id,status");
    semiPending = ((semi as any[]) ?? []).filter((s: any) => s.status === "PENDING").length;
  } catch {
    semiPending = 0;
  }

  const kpi = {
    activeOrders: orders.filter((o: any) => !["RELEASED", "CANCELLED"].includes(o.status)).length,
    totalItems: items.length,
    readyItems: items.filter((i: any) => i.status === "SEMI_READY").length,
    lowStock: stocks.filter((s: any) => s.low_stock).length,
    pendingSemi: semiPending,
    overdueSteps: 0,
    transfers: transfers.length,
    totalStock: stocks.length,
    alertes: alertes.length,
    reservations: reservations.length
  };

  return (
    <AdminShell
      pageTitle="Tableau de bord"
      pageHint={`Centre de pilotage ${nomUsine} — production, stocks, transferts.`}
    >
      <DashboardClient
        usine={usine}
        kpi={kpi}
        orders={orders}
        stocks={stocks}
        transfers={transfers}
        alertes={alertes}
        reservations={reservations}
      />
    </AdminShell>
  );
}
