import { headers } from "next/headers";
import { createServerSupabase } from "@/lib/supabase/server";
import { bilanJournee, classementOuvriers } from "@/app/actions-workflow";
import AdminShell from "@/components/admin/AdminShell";
import PageClient from "./PageClient";

export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════
// OUVRIERS — les QR du jour, l'affectation, le bilan
//
// C'est ici que l'administrateur :
//   • génère les codes du matin (deux par ouvrier)
//   • fixe qui passe en premier et qui passe en dernier
//   • lit le bilan automatique de la journée
//   • consulte le classement — réservé à lui seul
//
// Les ouvriers sont POLYVALENTS : ils changent de poste chaque
// jour. C'est pourquoi l'affectation est nominative et
// journalière, jamais figée dans un organigramme.
// ═══════════════════════════════════════════════════════════

const jourAujourdhui = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export default async function OuvriersPage({
  searchParams,
}: {
  searchParams?: { jour?: string };
}) {
  const jour = searchParams?.jour?.trim() || jourAujourdhui();
  const supabase: any = createServerSupabase();

  const [profils, ateliers, journees, etapes, bilan, classement] = await Promise.all([
    supabase.from("profiles").select("id, full_name, role, atelier_id, usine_code").eq("role", "WORKER").order("full_name"),
    supabase.from("ateliers").select("id, code, name, site").order("id"),
    supabase.from("journees_ouvrier").select("id, worker_id, atelier_id, qr_journee, qr_entree, arrivee_at, depart_at").eq("jour", jour),
    supabase
      .from("work_order_steps")
      .select("id, atelier_id, step_name, step_order, sequence, status, target_qty, estimated_minutes, work_order_items!inner(product_name, quantity, work_orders!inner(order_number))")
      .in("status", ["PENDING", "ACTIVE"])
      .order("atelier_id")
      .order("sequence")
      .limit(300),
    bilanJournee({ jour }),
    classementOuvriers({ limite: 100 }),
  ]);

  const h = headers();
  const host = h.get("host") ?? "";
  const proto = (h.get("x-forwarded-proto") ?? "https").split(",")[0];
  const baseUrl = host ? `${proto}://${host}` : "";

  const nomParWorker = new Map((profils.data ?? []).map((p: any) => [p.id, p.full_name ?? "Ouvrier"]));

  const listesJournees = (journees.data ?? []).map((j: any) => ({
    id: j.id,
    workerId: j.worker_id,
    nom: nomParWorker.get(j.worker_id) ?? "Ouvrier",
    atelierId: j.atelier_id ?? null,
    qrJournee: j.qr_journee as string,
    qrEntree: j.qr_entree as string,
    arrivee: j.arrivee_at ?? null,
    depart: j.depart_at ?? null,
  }));

  const listeEtapes = (etapes.data ?? []).map((s: any) => ({
    id: s.id,
    atelierId: s.atelier_id,
    nom: s.step_name,
    ordre: Number(s.step_order),
    sequence: Number(s.sequence),
    statut: s.status,
    quantite: Number(s.target_qty) || Number(s.work_order_items?.quantity) || 0,
    produit: s.work_order_items?.product_name ?? "—",
    commande: s.work_order_items?.work_orders?.order_number ?? "—",
    minutes: Number(s.estimated_minutes) || 30,
  }));

  const erreur =
    profils.error?.message ??
    journees.error?.message ??
    etapes.error?.message ??
    (bilan.ok ? null : bilan.message) ??
    null;

  return (
    <AdminShell
      pageTitle="Ouvriers & QR codes"
      pageHint="Deux codes par ouvrier, régénérés chaque matin. Le classement est visible de vous seul."
    >
      <PageClient
        jour={jour}
        baseUrl={baseUrl}
        ouvriers={(profils.data ?? []).map((p: any) => ({ id: p.id, nom: p.full_name ?? "Ouvrier", atelierId: p.atelier_id ?? null, usine: p.usine_code ?? "ADMEDCO" }))}
        ateliers={(ateliers.data ?? []).map((a: any) => ({ id: Number(a.id), code: a.code ?? "", nom: a.name ?? "", site: a.site ?? "ADMEDCO" }))}
        journees={listesJournees}
        etapes={listeEtapes}
        bilan={bilan.ok ? bilan.lignes : []}
        classement={classement.ok ? classement.lignes : []}
        classementMessage={classement.ok ? null : classement.message}
        erreur={erreur}
      />
    </AdminShell>
  );
}
