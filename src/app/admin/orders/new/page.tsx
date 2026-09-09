import { createServerSupabase } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import NewOrderClient from "./NewOrderClient";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  try {
    const supabase = createServerSupabase();
    const [{ data: categories, error: e1 }, { data: templates, error: e2 }] = await Promise.all([
      supabase.from("product_categories").select("id,name"),
      supabase.from("process_templates").select("category_id,standard_materials,has_branch,branch_insert_materials")
    ]);
    if (e1) throw new Error("product_categories: " + e1.message);
    if (e2) throw new Error("process_templates: " + e2.message);

    return (
      <AdminShell pageTitle="Nouvelle commande" pageHint="Créez une commande avec articles, dimensions, design et estimations matière.">
        <NewOrderClient categories={categories ?? []} templates={templates ?? []} />
      </AdminShell>
    );
  } catch (e: any) {
    return (
      <AdminShell pageTitle="Nouvelle commande" pageHint="Créez une commande avec articles, dimensions, design et estimations matière.">
        <div className="card space-y-2 border-red-200 p-6">
          <p className="font-black text-[#1a1d23]">Chargement du formulaire impossible</p>
          <p className="rounded-xl bg-red-50 px-3 py-2 font-mono text-xs text-red-500">{e?.message ?? String(e)}</p>
          <p className="text-sm text-[#7c8091]">
            Cause la plus fréquente : migrations <b>0005 → 0006 → 0007 → 0008</b> non exécutées dans Supabase
            (colonne <span className="font-mono">process_templates.standard_materials</span> manquante).
            Exécutez-les dans l'éditeur SQL Supabase, dans l'ordre, puis rechargez la page.
          </p>
        </div>
      </AdminShell>
    );
  }
}
