import { createServerSupabase } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import PageClient from "./PageClient";

export const dynamic = "force-dynamic";

// DOCUMENTS — miroir COM_Document + COM_DocumentDetail
export default async function DocumentsPage() {
  const supabase = createServerSupabase();
  const [{ data: docs }, { data: tiers }] = await Promise.all([
    supabase.from("erp_documents").select("*, erp_tiers(raison_sociale)").order("date_doc", { ascending: false }).limit(200),
    supabase.from("erp_tiers").select("id,raison_sociale").order("raison_sociale"),
  ]);
  return (
    <AdminShell pageTitle="Documents" pageHint="Devis, commandes, factures, bons — recopie COM_Document Silwane.">
      <PageClient docs={docs ?? []} tiers={tiers ?? []} />
    </AdminShell>
  );
}
