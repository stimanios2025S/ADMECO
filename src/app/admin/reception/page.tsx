import { createServerSupabase } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import ReceptionClient from "./ReceptionClient";
import { getProfil } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ReceptionPage() {
  const profil = await getProfil();
  const usine = profil?.usine_code ?? "ADMEDCO";
  const supabase: any = createServerSupabase();

  let receptions: any[] = [];
  try {
    const { data } = await supabase
      .from("receptions_mp")
      .select("id,usine_code,numero_facture,lignes,statut,created_at,fournisseurs(nom)")
      .eq("usine_code", usine)
      .order("created_at", { ascending: false })
      .limit(50);
    receptions = (data as any[]) ?? [];
  } catch {
    receptions = [];
  }

  return (
    <AdminShell pageTitle="Réception MP" pageHint={`Magasinier — usine ${usine} : collez la facture, vérifiez, confirmez l'entrée en stock.`}>
      <ReceptionClient usine={usine} historique={receptions} />
    </AdminShell>
  );
}
