import { createServerSupabase } from "@/lib/supabase/server";
import ManifestQrCard from "@/components/qr/ManifestQrCard";

export const dynamic = "force-dynamic";

export default async function ManifestPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: t } = await supabase.from("site_transfers").select("*, work_orders(order_number)").eq("manifest_qr", params.id).single();

  if (!t) {
    return (
      <div className="bg-mesh flex min-h-screen items-center justify-center px-4">
        <div className="glass max-w-md rounded-[28px] p-8 text-center">
          <div className="text-4xl">📦</div>
          <h1 className="mt-3 text-2xl font-black tracking-tight">Bordereau introuvable</h1>
          <p className="mt-2 text-sm text-zinc-400">Cette référence de transfert est invalide ou indisponible.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-mesh min-h-screen px-4 py-8 text-zinc-100">
      <div className="bg-grid-faint pointer-events-none fixed inset-0" />
      <div className="relative mx-auto max-w-3xl">
        <div className="premium-card rounded-[28px] p-5 sm:p-7">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-500">Bordereau de transfert</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.05em]">🚚 Expédition Atelier 2</h1>
            </div>
            <div className="inline-flex items-center rounded-full border border-ice/30 bg-ice/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-ice-soft">
              {(t as any).work_orders?.order_number ?? "Commande en attente"}
            </div>
          </div>

          <div className="space-y-5">
            <ManifestQrCard manifest={t.manifest_qr} orderNumber={(t as any).work_orders.order_number} itemCount={t.item_count} />

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
              <span className="font-bold text-white">Statut :</span> <span className="text-fire-soft">{t.status}</span>
              {t.verified_at ? ` · vérifié le ${t.verified_at}` : " · en attente du scan Atelier 2"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
