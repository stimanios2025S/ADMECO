"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeSteps } from "@/hooks/useRealtimeSteps";

type Order = { id: string; order_number: string; status: string };

export default function DashboardLive({ orders: initial }: { orders: Order[] }) {
  const tick = useRealtimeSteps();
  const [orders, setOrders] = useState(initial);
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("work_orders").select("id,order_number,status,created_at").order("created_at", { ascending: false }).limit(50);
      if (data) setOrders(data as any);
      const { data: bad } = await supabase.from("v_step_variance").select("*").gt("variance_min", 0).neq("status", "PENDING").limit(10);
      setAlerts(bad ?? []);
    })();
  }, [tick]);

  return (
    <div className="space-y-4">
      {alerts.length > 0 && (
        <div className="rounded-2xl border border-red-600 bg-red-950 p-4">
          <div className="font-black text-red-300">⚠️ Étapes en retard — en direct</div>
          {alerts.map((a: any) => (
            <div key={a.id} className="text-sm text-red-200">
              #{a.step_order} {a.step_name} : +{Number(a.variance_min).toFixed(0)} min hors cible ({Number(a.actual_minutes).toFixed(0)}/{a.estimated_minutes} min)
            </div>
          ))}
        </div>
      )}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {orders.map((o) => (
          <Link key={o.id} href={`/orders/${o.id}`}
            className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 hover:border-yellow-400 transition">
            <div className="flex items-center justify-between">
              <span className="font-black text-lg">{o.order_number}</span>
              <span className="rounded-lg bg-zinc-700 px-2 py-0.5 text-xs font-bold">{o.status}</span>
            </div>
            <div className="text-sm text-zinc-400 mt-1">{o.status}</div>
            <div className="text-yellow-300 text-sm mt-1 font-bold">Ouvrir → pipeline en direct</div>
          </Link>
        ))}
        {orders.length === 0 && <p className="text-zinc-500">Aucune commande — créez-en une ci-dessus.</p>}
      </div>
    </div>
  );
}
