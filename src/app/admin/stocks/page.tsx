import { createServerSupabase } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import StocksClient from "./StocksClient";
import { getProfil, depotsUsine } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function StocksPage() {
  const profil = await getProfil();
  const usine = profil?.usine_code ?? "ADMEDCO";
  const depots = depotsUsine(usine);
  const supabase: any = createServerSupabase();

  // Stocks scopés usine (dépôts de l'usine, fallback global)
  let stocks: any[] = [];
  try {
    const { data, error } = await supabase.from("v_stock_status").select("*").in("depot_code", depots).order("name");
    if (error) throw error;
    stocks = (data as any[]) ?? [];
  } catch {
    const { data } = await supabase.from("v_stock_status").select("*").order("name");
    stocks = (data as any[]) ?? [];
  }

  const [{ data: movements }] = await Promise.all([
    supabase.from("stock_movements").select("*, stock_items(name,unit)").order("created_at", { ascending: false }).limit(50)
  ]);
  const [{ data: reservations }, { data: semiStock }] = await Promise.all([
    supabase.from("order_item_reservations").select("*, stock_items(name,unit)").limit(200),
    supabase.from("semi_finished_stock").select("*, work_order_items(product_name,quantity)").order("created_at", { ascending: false }).limit(50)
  ]);

  const mpDepot = usine === "MOBILIX" ? "DEP-MP-MBX" : "DEP-MP";
  const hint =
    usine === "MOBILIX"
      ? `MOBILIX — Matière Première ${mpDepot}, Stock atelier DEP-M1.`
      : `ADMEDCO — Matière Première centrale ${mpDepot} (alimente A1+A2), Stock Atelier 1 (produit par A1), Stock Atelier 2 (produit par A2).`;

  return (
    <AdminShell pageTitle="Stocks" pageHint={hint}>
      <StocksClient
        stocks={(stocks ?? []) as any[]}
        movements={(movements ?? []) as any[]}
        reservations={(reservations ?? []) as any[]}
        semiStock={(semiStock ?? []) as any[]}
      />
    </AdminShell>
  );
}
