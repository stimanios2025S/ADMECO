import { createServerSupabase } from "@/lib/supabase/server";
import TemplateBuilder from "@/components/admin/TemplateBuilder";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const supabase = createServerSupabase();
  const { data: categories } = await supabase.from("product_categories").select("id,name").order("name");
  const { data: rows } = await supabase.from("process_templates").select("*").order("step_order").limit(500);
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black">🧩 Routing templates (per category)</h1>
      <p className="text-zinc-400 text-sm">Build, clone & edit multi-step routing per product category. New work orders auto-instance the selected template.</p>
      <TemplateBuilder categories={categories ?? []} rows={(rows ?? []) as any} />
    </div>
  );
}
