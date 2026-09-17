import { createServerSupabase } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import DestinationsClient from "./DestinationsClient";
import { getProfil } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DestinationsPage() {
  const profil = await getProfil();
  const usine = profil?.usine_code ?? "ADMEDCO";
  const supabase: any = createServerSupabase();
  const isMobilix = usine === "MOBILIX";

  // Lots semi-finis PENDING (scopé usine via articles → commandes)
  let lots: any[] = [];
  try {
    let itemIds: string[] | null = null;
    try {
      const { data: orders } = await supabase.from("work_orders").select("id").eq("usine_code", usine);
      const oIds = ((orders as any[]) ?? []).map((o: any) => o.id);
      if (oIds.length > 0) {
        const { data: its } = await supabase.from("work_order_items").select("id").in("order_id", oIds);
        itemIds = ((its as any[]) ?? []).map((i: any) => i.id);
      } else itemIds = [];
    } catch {
      itemIds = null;
    }
    let q: any = supabase.from("semi_finished_stock").select("id,item_id,quantity,status,created_at,work_order_items(product_name,quantity,order_id,work_orders(order_number))").eq("status", "PENDING");
    if (itemIds) {
      if (itemIds.length === 0) lots = [];
      else {
        const { data } = await q.in("item_id", itemIds);
        lots = (data as any[]) ?? [];
      }
    } else {
      const { data } = await q.order("created_at", { ascending: false }).limit(100);
      lots = (data as any[]) ?? [];
    }
  } catch {
    lots = [];
  }

  // Décisions existantes (historique + exclure les lots déjà décidés)
  let decisions: any[] = [];
  try {
    const { data } = await supabase
      .from("destinations")
      .select("id,semi_stock_id,order_item_id,destination,bordereau,statut,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    decisions = (data as any[]) ?? [];
  } catch {
    decisions = [];
  }
  const decideIds = new Set(decisions.map((d: any) => d.semi_stock_id).filter(Boolean));
  const enAttente = lots.filter((l: any) => !decideIds.has(l.id));

  // Réceptions en attente MOBILIX (transferts destination MOBILIX)
  let receptionsMobilix: any[] = [];
  if (isMobilix) {
    try {
      const { data } = await supabase
        .from("site_transfers")
        .select("id,order_id,order_item_id,destination,manifest_qr,status,created_at")
        .eq("destination", "MOBILIX")
        .order("created_at", { ascending: false })
        .limit(50);
      receptionsMobilix = (data as any[]) ?? [];
    } catch {
      receptionsMobilix = [];
    }
  }

  return (
    <AdminShell
      pageTitle="Destinations"
      pageHint={isMobilix ? "Réceptions en attente vers MOBILIX." : "Décidez : envoyer à MOBILIX ou livrer le client direct."}
    >
      <DestinationsClient
        usine={usine}
        enAttente={enAttente}
        decisions={decisions}
        receptionsMobilix={receptionsMobilix}
      />
    </AdminShell>
  );
}
