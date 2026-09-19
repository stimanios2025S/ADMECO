import { createServerSupabase } from "@/lib/supabase/server";
import { stocksSousSeuil, detteOuverte } from "@/app/actions-workflow";
import AdminShell from "@/components/admin/AdminShell";
import PageClient from "./PageClient";

export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════
// SEUILS & RÉCUPÉRATION — la règle du plancher bas / plafond haut
//
// Le sous-stock d'un atelier ne doit pas descendre sous son
// plancher. Si une sortie l'y ferait descendre, le manque n'est
// PAS produit sur-le-champ : il devient une DETTE, absorbée par la
// commande suivante.
//
//   sous-stock 500 − commande 350 = 150   (plancher 200)
//   manque 50 → enregistré, non produit
//   commande suivante 400 → on en produit 450
//
// C'est l'exploitant qui fixe les seuils, article par article :
// le 200 / 300 est une règle connue, pas une constante globale.
// ═══════════════════════════════════════════════════════════

export default async function SeuilsPage() {
  const supabase: any = createServerSupabase();

  const [sousSeuil, dette, stocks] = await Promise.all([
    stocksSousSeuil(),
    detteOuverte(),
    supabase
      .from("stock_items")
      .select("id, code, name, depot_code, usine_code, quantity, min_qty, max_qty")
      .order("usine_code")
      .order("depot_code")
      .order("code")
      .limit(500),
  ]);

  const erreur =
    sousSeuil.ok && dette.ok ? stocks.error?.message ?? null : sousSeuil.message ?? dette.message;

  return (
    <AdminShell
      pageTitle="Seuils & récupération"
      pageHint="Le plancher déclenche la dette ; la commande suivante l'absorbe. Aucun manque n'est produit en urgence sous le seuil."
    >
      <PageClient
        sousSeuil={sousSeuil.ok ? sousSeuil.lignes : []}
        dette={dette.ok ? dette.lignes : []}
        stocks={(stocks.data ?? []).map((s: any) => ({
          id: s.id,
          code: s.code ?? "—",
          nom: s.name ?? "—",
          depotCode: s.depot_code ?? "—",
          usine: s.usine_code ?? "ADMEDCO",
          quantite: Number(s.quantity) || 0,
          min: s.min_qty === null || s.min_qty === undefined ? null : Number(s.min_qty),
          max: s.max_qty === null || s.max_qty === undefined ? null : Number(s.max_qty),
        }))}
        erreur={erreur}
      />
    </AdminShell>
  );
}
