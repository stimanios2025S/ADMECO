import { createServerSupabase } from "@/lib/supabase/server";
import ManifestQrCard from "@/components/qr/ManifestQrCard";

export const dynamic = "force-dynamic";

export default async function ManifestPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: t } = await supabase.from("site_transfers").select("*, work_orders(order_number)").eq("manifest_qr", params.id).single();
  if (!t) return <p>Manifest not found.</p>;
  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h1 className="text-2xl font-black">🚚 Transfer manifest</h1>
      <ManifestQrCard manifest={t.manifest_qr} orderNumber={(t as any).work_orders.order_number} itemCount={t.item_count} />
      <p className="text-zinc-400 text-sm">Status: <b>{t.status}</b> {t.verified_at ? `· verified ${t.verified_at}` : "· awaiting Site B scan"}</p>
    </div>
  );
}
