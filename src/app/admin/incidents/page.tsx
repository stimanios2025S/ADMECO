import { createServerSupabase } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import IncidentsClient from "./IncidentsClient";
import { getProfil, depotsUsine } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function IncidentsPage() {
  const profil = await getProfil();
  const usine = profil?.usine_code ?? "ADMEDCO";
  const supabase: any = createServerSupabase();

  // Alertes de l'usine
  let alertes: any[] = [];
  try {
    const { data } = await supabase
      .from("alertes")
      .select("*")
      .eq("usine_code", usine)
      .order("created_at", { ascending: false })
      .limit(100);
    alertes = (data as any[]) ?? [];
  } catch {
    alertes = [];
  }

  // Stock bas scopé usine (via dépôts)
  let lowStock: any[] = [];
  try {
    const { data } = await supabase.from("v_stock_status").select("*").in("depot_code", depotsUsine(usine));
    lowStock = ((data as any[]) ?? []).filter((s: any) => s.low_stock);
  } catch {
    try {
      const { data } = await supabase.from("v_stock_status").select("*").eq("low_stock", true);
      lowStock = (data as any[]) ?? [];
    } catch {
      lowStock = [];
    }
  }

  // Étapes en retard (variance > 0)
  let overdue: any[] = [];
  try {
    const { data } = await supabase
      .from("v_step_variance")
      .select("*")
      .gt("variance_min", 0)
      .neq("status", "PENDING")
      .order("variance_min", { ascending: false })
      .limit(50);
    overdue = (data as any[]) ?? [];
  } catch {
    overdue = [];
  }

  return (
    <AdminShell pageTitle="Alertes" pageHint={`Alertes de l'usine ${usine} — emprunts, stock bas, étapes en retard.`}>
      <IncidentsClient usine={usine} alertes={alertes} lowStock={lowStock} overdue={overdue} />
    </AdminShell>
  );
}
