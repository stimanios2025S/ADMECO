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
      <AdminShell pageTitle="New order" pageHint="Create a production order with items, dimensions, design and material estimates.">
        <NewOrderClient categories={categories ?? []} templates={templates ?? []} />
      </AdminShell>
    );
  } catch (e: any) {
    return (
      <AdminShell pageTitle="New order" pageHint="Create a production order with items, dimensions, design and material estimates.">
        <div className="card space-y-2 border-red-200 p-6">
          <p className="font-black text-[#1a1d23]">Couldn't load the order form</p>
          <p className="rounded-xl bg-red-50 px-3 py-2 font-mono text-xs text-red-500">{e?.message ?? String(e)}</p>
          <p className="text-sm text-[#7c8091]">
            Most common cause: database migrations <b>0005 → 0006 → 0007</b> were not run in Supabase
            (missing <span className="font-mono">process_templates.standard_materials</span> column).
            Run them in the Supabase SQL Editor, in order, then reload this page.
          </p>
        </div>
      </AdminShell>
    );
  }
}
