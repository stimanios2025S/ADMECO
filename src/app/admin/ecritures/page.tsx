import { createServerSupabase } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import PageClient from "./PageClient";

export const dynamic = "force-dynamic";

// COMPTABILITÉ — miroir ACC_Operation
export default async function EcrituresPage() {
  const supabase = createServerSupabase();
  const { data } = await supabase.from("erp_ecritures").select("*").order("date_ecriture", { ascending: false }).limit(200);
  return (
    <AdminShell pageTitle="Comptabilité" pageHint="Écritures ADMEDCO — recopie ACC_Operation Silwane.">
      <PageClient ecritures={data ?? []} />
    </AdminShell>
  );
}
