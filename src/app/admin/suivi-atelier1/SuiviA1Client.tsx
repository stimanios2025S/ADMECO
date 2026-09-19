"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Flag, Hammer, Play, CheckCircle2, Clock, Loader2, Package, Target } from "lucide-react";
import { lancerSuiviEco } from "@/app/actions-usines";
import { ETAPES_A1_GAMME } from "@/lib/process-eco";
import { cn } from "@/lib/utils";

type Props = { usine: string; orders: any[]; items: any[]; steps: any[] };

const PRIORITES = [
  { value: 1, label: "Urgente", dot: "bg-red-500" },
  { value: 2, label: "Haute", dot: "bg-orange-500" },
  { value: 3, label: "Normale", dot: "bg-[#4a7c59]" },
  { value: 4, label: "Basse", dot: "bg-[#2f6eb5]" },
  { value: 5, label: "Très basse", dot: "bg-[#9ca3af]" },
];

export default function SuiviA1Client({ usine, orders, items, steps }: Props) {
  const router = useRouter();
  const [numero, setNumero] = useState("");
  const [produit, setProduit] = useState("");
  const [qty, setQty] = useState(20);
  const [priority, setPriority] = useState(3);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [ouvert, setOuvert] = useState<string | null>(null);

  const stepsParItem = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const step of steps) {
      const key = String(step.item_id);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(step);
    }
    return map;
  }, [steps]);

  const lancer = async () => {
    setBusy(true);
    setMsg("");
    const result = await lancerSuiviEco({
      orderNumber: numero.trim(),
      productName: produit.trim(),
      quantity: qty,
      priority,
    });
    setMsg(result.ok ? `✅ ${result.message}` : `❌ ${result.message}`);
    if (result.ok) {
      setNumero("");
      setProduit("");
      router.refresh();
    }
    setBusy(false);
  };

  return (
    <div className="stagger space-y-5">
      {msg && (
        <div className={cn("rounded-2xl border p-4 text-sm font-bold shadow-sm", msg.startsWith("✅") ? "border-[#4a7c59]/20 bg-[#4a7c59]/[0.06] text-[#4a7c59]" : "border-red-200 bg-red-50 text-red-600")}>
          {msg}
        </div>
      )}

      <div className="card p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#9ca3af]">Nouvel ordre de fabrication</p>
        <h2 className="mt-1 flex items-center gap-2 text-xl font-black tracking-tight text-[#1a1d23]">
          <Hammer size={19} className="text-[#c24a08]" /> Gamme Tôle - Atelier 01
        </h2>
        <p className="mt-1 text-sm text-[#6b7280]">
          La commande crée les {ETAPES_A1_GAMME.length} étapes (6 postes de production + le transfert vers l'Atelier 3)
          et un objectif initial égal à la quantité commandée.
        </p>

        <div className="mt-4 grid gap-2 lg:grid-cols-[1fr_1fr_130px_190px_auto]">
          <input value={numero} onChange={(e) => setNumero(e.target.value)}
            placeholder={`N° OF (ex. ECO-${new Date().getFullYear()}-001)`}
            className="rounded-xl border border-black/[0.08] bg-white px-4 py-3 text-sm font-bold text-[#1a1d23] placeholder:font-normal placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#c24a08]/20" />
          <input value={produit} onChange={(e) => setProduit(e.target.value)}
            placeholder="Produit ECO (ex. Chaise ECO noire)"
            className="rounded-xl border border-black/[0.08] bg-white px-4 py-3 text-sm font-bold text-[#1a1d23] placeholder:font-normal placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#c24a08]/20" />
          <label className="flex items-center gap-2 rounded-xl border border-black/[0.08] bg-white px-3 py-3">
            <Package size={15} className="text-[#9ca3af]" />
            <input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
              className="min-w-0 flex-1 bg-transparent text-sm font-black text-[#1a1d23] focus:outline-none" />
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-black/[0.08] bg-white px-3 py-3">
            <Flag size={15} className="text-[#9ca3af]" />
            <select value={priority} onChange={(e) => setPriority(Number(e.target.value))}
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-[#1a1d23] focus:outline-none">
              {PRIORITES.map((p) => <option key={p.value} value={p.value}>P{p.value} - {p.label}</option>)}
            </select>
          </label>
          <button disabled={busy || !numero.trim() || !produit.trim()} onClick={lancer}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#c24a08] px-5 py-3 text-sm font-bold text-white disabled:opacity-40 transition-opacity">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Créer
          </button>
        </div>
      </div>

      <div className="card p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#9ca3af]">Flux officiel ECO</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {ETAPES_A1_GAMME.map((step) => (
            <div key={step.code} className="min-h-28 rounded-xl border border-black/[0.05] bg-black/[0.02] p-3">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#c24a08]/10 text-sm">{step.icone}</span>
              <p className="mt-2 text-[12px] font-black text-[#1a1d23]">{step.ordre}. {step.nom}</p>
              <p className="mt-1 text-[11px] leading-4 text-[#6b7280]">{step.description}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-[#9ca3af]">L'admin ouvre la commande pour ajuster les objectifs, changer la priorité et imprimer les QR des postes. Les pièces sortent vers l'Atelier 3 (poudrage), pas directement en stock produit fini.</p>
      </div>

      <div className="card p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#9ca3af]">Ordres ECO en cours - {orders.length}</p>
        {orders.length === 0 ? (
          <p className="mt-3 rounded-xl bg-black/[0.02] p-6 text-center text-sm font-bold text-[#9ca3af]">Aucun ordre ECO lancé.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {orders.map((order: any) => {
              const orderItems = items.filter((item: any) => item.order_id === order.id);
              const orderSteps = orderItems.flatMap((item: any) => stepsParItem.get(String(item.id)) ?? []);
              const done = orderSteps.filter((s: any) => s.status === "DONE").length;
              const active = orderSteps.filter((s: any) => s.status === "ACTIVE").length;
              const total = orderSteps.length;
              const percent = total ? Math.round((done / total) * 100) : 0;
              const priorityInfo = PRIORITES.find((p) => p.value === Number(order.priority)) ?? PRIORITES[2];
              const isOpen = ouvert === order.id;
              return (
                <div key={order.id} className="overflow-hidden rounded-2xl border border-black/[0.05] bg-white">
                  <button onClick={() => setOuvert(isOpen ? null : order.id)} className="flex w-full items-center gap-3 p-4 text-left">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#c24a08]/10 text-lg">🪚</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-[#1a1d23]">{order.order_number}</span>
                      <span className="block text-xs text-[#9ca3af]">{orderItems.map((i: any) => i.product_name).join(", ")} · {done}/{total} étapes · {percent}%</span>
                      <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-black/[0.05]"><span className="block h-full rounded-full bg-[#c24a08]" style={{ width: `${percent}%` }} /></span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-black/[0.03] px-2 py-1 text-[10px] font-black text-[#6b7280]"><span className={`h-1.5 w-1.5 rounded-full ${priorityInfo.dot}`} />P{priorityInfo.value}</span>
                    {active > 0 && <span className="hidden shrink-0 items-center gap-1 rounded-full bg-[#c24a08]/10 px-2 py-1 text-[10px] font-black text-[#c24a08] sm:flex"><Clock size={10} /> {active} en cours</span>}
                    {percent === 100 && total > 0 && <span className="hidden shrink-0 items-center gap-1 rounded-full bg-[#4a7c59]/10 px-2 py-1 text-[10px] font-black text-[#4a7c59] sm:flex"><CheckCircle2 size={10} /> Terminé</span>}
                  </button>
                  {isOpen && (
                    <div className="border-t border-black/[0.04] p-4">
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {orderSteps.slice().sort((a: any, b: any) => Number(a.step_order) - Number(b.step_order)).map((s: any) => (
                          <div key={s.id} className="flex items-center gap-2 rounded-lg bg-black/[0.02] px-2.5 py-2 text-[12px]">
                            <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-md text-[10px] font-black text-white", s.status === "DONE" ? "bg-[#4a7c59]" : s.status === "ACTIVE" ? "bg-[#c24a08]" : "bg-black/20")}>{s.step_order}</span>
                            <span className="min-w-0 flex-1 truncate font-bold text-[#1a1d23]">{s.step_name}</span>
                            <span className="text-[10px] font-bold text-[#9ca3af]"><Target size={10} className="mr-0.5 inline" />{Number(s.target_qty) || 0}</span>
                            <span className="text-[10px] font-bold text-[#4a7c59]">OK {Number(s.quantity_ok) || 0}</span>
                          </div>
                        ))}
                      </div>
                      <button onClick={() => router.push(`/admin/orders/${order.id}`)} className="mt-3 text-xs font-bold text-[#c24a08] hover:underline">Gérer objectifs, priorité et QR</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-3 text-[11px] text-[#9ca3af]">Usine : <b>{usine}</b> · Portail ouvrier sans mot de passe.</p>
      </div>
    </div>
  );
}
