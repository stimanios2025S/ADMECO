import { createServerSupabase } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import TemplateBuilder from "@/components/admin/TemplateBuilder";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const supabase = createServerSupabase();
  const { data: categories } = await supabase.from("product_categories").select("id,name").order("name");
  const { data: rows } = await supabase.from("process_templates").select("*").order("step_order").limit(1000);
  return (
    <AdminShell pageTitle="Routing templates" pageHint="Build, clone & edit multi-step routing per product category.">
      <TemplateBuilder categories={categories ?? []} rows={(rows ?? []) as any} />
    </AdminShell>
  );
}
