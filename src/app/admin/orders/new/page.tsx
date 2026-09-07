import { createServerSupabase } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import NewOrderClient from "./NewOrderClient";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  const supabase = createServerSupabase();
  const [{ data: categories }, { data: templates }] = await Promise.all([
    supabase.from("product_categories").select("id,name"),
    supabase.from("process_templates").select("category_id,standard_materials,has_branch,branch_insert_materials")
  ]);

  return (
    <AdminShell pageTitle="New order" pageHint="Create a production order with items, dimensions, design and material estimates.">
      <NewOrderClient categories={categories ?? []} templates={templates ?? []} />
    </AdminShell>
  );
}
