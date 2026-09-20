"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { statutFr } from "@/lib/fr";
import { ETAPES_M1, ETAPES_M2 } from "@/lib/etapes";
import { ordreMobilixCourt } from "@/lib/process-mobilix";
import { verifyTransfer } from "@/app/actions";
import { signalerSync } from "./PortalSync";
import Link from "next/link";
import { Clock, Loader2, Package, Truck } from "lucide-react";

type Etape = {
  id: string; step_order: number; step_name: string; status: string;
  estimated_minutes: number; started_at: string | null;
  work_order_items?: { product_name: string; quantity: number } | null;
};

type Reception = {
  id: string; manifest_qr: string; item_count: number; status: string;
  destination: string | null; created_at: string;
  work_orders?: { order_number: string } | null;
};

// ═══════════════════════════════════════════════════════════
// LES OUTILS DU POSTE MOBILIX
//
// ── Un composant, deux ateliers ──
// MOBILIX 1 (découpe bois, id 3) et MOBILIX 2 (tapissage, id 5) font
// un travail différent mais regardent le même écran : la file du
// poste, l'avancement, les réceptions ADMEDCO. Ce qui change tient en
// trois valeurs — l'atelier interrogé, la gamme affichée, la couleur.
//
// Ces trois valeurs viennent des PROPS, jamais d'une constante. La
// version précédente filtrait sur `atelier_id = 3` en dur : montée
// pour M2, elle aurait affiché la file du bois sous le titre du
// tapissage, et l'ouvrier aurait déclaré une étape qui n'était pas la
// sienne. C'est la faute la plus coûteuse du système — d'où le choix
// d'avoir mis l'atelier dans le CHEMIN de l'URL (`/atelier/m2/scan`)
// plutôt que dans un paramètre qu'on peut oublier de transmettre.
// ═══════════════════════════════════════════════════════════

type Props = {
  /** 3 = MOBILIX 1 (découpe bois), 5 = MOBILIX 2 (tapissage). */
  atelierId: 3 | 5;
  etape?: number | null;
};

export default function MobilixTools({ atelierId, etape }: Props) {
  const tapissage = atelierId === 5;

  const gammes = tapissage ? ETAPES_M2 : ETAPES_M1;
  const accent = tapissage ? "#c026d3" : "#7c3aed";
  const accentSoft = tapissage ? "rgba(192,38,211,.06)" : "rgba(124,58,237,.06)";
  const accentBorder = tapissage ? "rgba(192,38,211,.15)" : "rgba(124,58,237,.15)";
  /** L'adresse de CET atelier — d'où l'on vient et où l'on retourne. */
  const base = tapissage ? "/atelier/m2" : "/atelier/m1";
  const nomAtelier = tapissage ? "MOBILIX 2 — Tapissage" : "MOBILIX 1 — Découpe bois";

  const def = gammes.find((e) => e.ordre === etape) ?? null;

  const [lignes, setLignes] = useState<Etape[]>([]);
  const [stats, setStats] = useState({ pending: 0, active: 0, done: 0 });
  const [receptions, setReceptions] = useState<Reception[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [charge, setCharge] = useState(true);

  useEffect(() => {
    let actif = true;
    const charger = async () => {
      const supabase = createClient();

      let q = supabase.from("work_order_steps")
        .select("id,step_order,step_name,status,estimated_minutes,started_at,work_order_items(product_name,quantity)")
        .eq("atelier_id", atelierId);
      if (etape) q = q.eq("step_order", etape);
      q = q.order("step_order").limit(20);
      const { data } = await q;
      if (actif && data) setLignes(data as any);

      let sq = supabase.from("work_order_steps").select("status", { count: "exact" }).eq("atelier_id", atelierId);
      if (etape) sq = sq.eq("step_order", etape);
      const { count: total } = await sq;
      let sq2 = supabase.from("work_order_steps").select("status", { count: "exact" }).eq("atelier_id", atelierId).eq("status", "DONE");
      if (etape) sq2 = sq2.eq("step_order", etape);
      const { count: done } = await sq2;
      let sq3 = supabase.from("work_order_steps").select("status", { count: "exact" }).eq("atelier_id", atelierId).eq("status", "ACTIVE");
      if (etape) sq3 = sq3.eq("step_order", etape);
      const { count: active } = await sq3;
      if (actif) setStats({ pending: (total ?? 0) - (done ?? 0) - (active ?? 0), active: active ?? 0, done: done ?? 0 });

      // ── Réceptions ADMEDCO → MOBILIX ──
      // Les bordereaux entrent par la découpe bois : c'est M1 qui
      // reçoit la matière d'ADMEDCO, puis la fait circuler. M2
      // consomme ce que M1 a préparé — lui montrer la file des
      // réceptions l'inviterait à réceptionner deux fois.
      if (!tapissage) {
        try {
          const { data: rData } = await supabase.from("site_transfers")
            .select("id,manifest_qr,item_count,status,destination,created_at,work_orders(order_number)")
            .eq("destination", "MOBILIX")
            .order("created_at", { ascending: false }).limit(10);
          if (actif && rData) setReceptions(rData as any);
        } catch {
          /* colonne destination absente (avant 0012) */
        }
      }
      if (actif) setCharge(false);
    };
    void charger();
    // Recharger à chaque signal de synchronisation (temps réel / bouton Synchroniser)
    window.addEventListener("mes-sync", charger);
    return () => { actif = false; window.removeEventListener("mes-sync", charger); };
  }, [etape, atelierId, tapissage]);

  const total = stats.done + stats.active + stats.pending;
  const pct = total > 0 ? Math.round((stats.done / total) * 100) : 0;

  const receptionner = async (id: string) => {
    setBusy(id);
    try {
      await verifyTransfer(id, true);
      setMsg("✅ Réception ADMEDCO confirmée — articles en Stock M1");
      signalerSync();
    } catch (e: any) {
      setMsg(`❌ ${e.message}`);
    }
    setBusy(null);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* ── Info card ── */}
      <div className="rounded-2xl border border-black/[0.04] bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: accentSoft, color: accent }}>
            {def ? `Poste ${ordreMobilixCourt(def.ordre)}/${gammes.length}` : nomAtelier}
          </span>
          {def && <span className="rounded-full bg-black/[0.04] px-2.5 py-1 text-[11px] font-bold text-[#9ca3af]">{def.code}</span>}
        </div>

        <h2 className="mt-3 text-2xl font-black tracking-tight text-[#1a1d23]">
          {def
            ? `${def.icone} ${def.nom}`
            : tapissage
              ? "🧵 Tapissage MOBILIX"
              : "📦 Réception & Finition MOBILIX"}
        </h2>
        <p className="mt-1 text-sm text-[#6b7280]">
          {def
            ? def.description
            : tapissage
              ? "Coupe, couture, rembourrage et emballage de la chaise."
              : "Réception ADMEDCO, contrôle, finition, emballage."}
        </p>

        {def && (
          <div className="mt-3 rounded-xl px-3 py-2.5 text-xs font-semibold" style={{ background: accentSoft, color: accent }}>
            📋 {def.consigne}
          </div>
        )}

        <div className="mt-3 rounded-xl bg-black/[0.02] px-3 py-2 text-xs text-[#6b7280]">
          {tapissage ? (
            <>
              🧵 <span className="font-bold text-[#1a1d23]">M1 fournit</span> le piètement et les inserts → coupe et
              couture ici · Production → <span className="font-bold text-[#1a1d23]">Stock M2</span>
            </>
          ) : (
            <>
              🚚 <span className="font-bold text-[#1a1d23]">ADMEDCO expédie</span> → réception M1 ·{" "}
              <span className="font-bold text-[#1a1d23]">DEP-MP-MBX</span> alimente ce poste · Production →{" "}
              <span className="font-bold text-[#1a1d23]">Stock M1</span>
            </>
          )}
        </div>

        {/* Progress bar */}
        {!charge && total > 0 && (
          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-[#9ca3af]">
              <span>{stats.done} terminée{stats.done > 1 ? "s" : ""} sur {total}</span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-black/[0.04]">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: accent }} />
            </div>
            <div className="flex gap-4 text-[11px] font-bold text-[#9ca3af]">
              <span className="flex items-center gap-1"><Clock size={11} /> {stats.active} en cours</span>
              <span className="flex items-center gap-1"><Package size={11} /> {stats.pending} en attente</span>
            </div>
          </div>
        )}

        {/* Quick nav — les postes de CET atelier, pas ceux du voisin */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {gammes.map((e) => (
            <Link key={e.code} href={`${base}/scan?etape=${e.ordre}`}
              className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors"
              style={e.ordre === etape
                ? { background: accentSoft, color: accent, boxShadow: `inset 0 0 0 1px ${accentBorder}` }
                : { background: "rgba(0,0,0,.03)", color: "#9ca3af" }}>
              {e.icone} {ordreMobilixCourt(e.ordre)}
            </Link>
          ))}
        </div>
        {msg && <p className="mt-2 rounded-xl bg-black/[0.02] px-3 py-2 text-sm font-bold text-[#1a1d23]">{msg}</p>}

        {def && (
          <Link href={base}
            className="mt-3 inline-flex items-center gap-1 rounded-xl border border-black/[0.06] bg-black/[0.02] px-3 py-2 text-xs font-bold text-[#6b7280] hover:text-[#1a1d23] transition-colors">
            ← Tous les postes {tapissage ? "M2" : "M1"}
          </Link>
        )}
      </div>

      {/* ── Queue + réceptions ── */}
      <div className="rounded-2xl border border-black/[0.04] bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#9ca3af]">
            {def ? `File — Poste ${def.ordre}` : `File — ${nomAtelier}`} · {lignes.length}
          </p>
        </div>

        {charge ? (
          <div className="mt-4 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl bg-black/[0.02] p-3 animate-pulse">
                <div className="h-5 w-5 rounded bg-black/[0.06]" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-3/4 rounded bg-black/[0.06]" />
                  <div className="h-2.5 w-1/2 rounded bg-black/[0.04]" />
                </div>
              </div>
            ))}
          </div>
        ) : lignes.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-black/[0.08] bg-black/[0.01] p-8 text-center">
            <p className="text-3xl">{def ? "✅" : "📭"}</p>
            <p className="mt-2 text-sm font-bold text-[#6b7280]">
              {def ? `Aucune pièce pour ${def.nom}` : "Aucune étape en attente"}
            </p>
            <p className="mt-1 text-xs text-[#9ca3af]">Toutes les pièces ont été traitées.</p>
          </div>
        ) : (
          <div className="mt-3 space-y-1.5">
            {lignes.map((e) => (
              <div key={e.id}
                className="flex items-center gap-3 rounded-xl p-3 text-sm transition-colors"
                style={e.status === "ACTIVE"
                  ? { border: `1px solid ${accentBorder}`, background: accentSoft }
                  : { background: "rgba(0,0,0,.02)" }}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black text-white" style={{ background: accent }}>
                  {e.step_order}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-[#1a1d23]">{e.step_name}</span>
                  <span className="block text-xs text-[#9ca3af]">{e.work_order_items?.product_name} ×{e.work_order_items?.quantity}</span>
                </span>
                {e.status === "ACTIVE" && e.started_at && (
                  <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: accent }}>
                    <Loader2 size={10} className="animate-spin" /> en cours
                  </span>
                )}
                <span className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold"
                  style={e.status === "ACTIVE"
                    ? { background: accentSoft, color: accent }
                    : e.status === "DONE"
                      ? { background: "rgba(74,124,89,.08)", color: "#4a7c59" }
                      : { background: "rgba(0,0,0,.04)", color: "#9ca3af" }}>
                  {statutFr(e.status)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Réceptions ADMEDCO — visibles à l'étape 1 (matière entrante) */}
        {!tapissage && (def?.ordre === 1 || (!def && receptions.some((r) => r.status === "PENDING"))) && receptions.length > 0 && (
          <div className="mt-4 border-t border-black/[0.04] pt-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#9ca3af]">
              <Truck size={11} className="mr-1 inline" /> Réceptions ADMEDCO · {receptions.length}
            </p>
            <div className="mt-2 space-y-1.5">
              {receptions.map((b) => (
                <div key={b.id} className="flex items-center gap-2 rounded-xl bg-black/[0.02] px-3 py-2 text-sm">
                  <span className="font-mono font-bold" style={{ color: accent }}>{b.manifest_qr}</span>
                  <span className="min-w-0 flex-1 truncate text-[#6b7280]">{b.work_orders?.order_number} · ×{b.item_count}</span>
                  <span className="rounded-md bg-black/[0.04] px-1.5 py-0.5 text-[11px] font-bold text-[#9ca3af]">{statutFr(b.status)}</span>
                  {b.status === "PENDING" && (
                    <button disabled={busy === b.id} onClick={() => receptionner(b.id)}
                      className="rounded-lg px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-40 transition-opacity"
                      style={{ background: accent }}>
                      {busy === b.id ? "…" : "Réceptionner"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
